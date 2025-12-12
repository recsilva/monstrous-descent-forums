// index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

const PRIVILEGE = {
  USER: 0,
  MOD: 1,
  ADMIN: 2
};

// --- JWT AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    // 1. Get token from the Authorization header
    // The format is typically "Bearer TOKEN_STRING"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) {
        // No token provided
        return res.status(401).json({ error: 'Authentication token required' });
    }

    // 2. Verify the token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Token is invalid, expired, or tampered with
            console.error('JWT verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // 3. Attach decoded payload (user data, including role) to the request object
        req.user = user; 
        next(); // Proceed to the route handler
    });
};
// ----------------------------------------

// --- AUTHORIZATION MIDDLEWARE (Role Check) ---
const authorizePrivilege = (requiredLevel) => (req, res, next) => {
    // req.user.role is the privileges integer (0, 1, or 2)
    if (!req.user || req.user.privileges < requiredLevel) {
        // 403 Forbidden: User is authenticated but does not meet the minimum privilege level
        return res.status(403).json({ error: 'Access denied. Insufficient privileges.' });
    }
    next();
};

const requireModerator = authorizePrivilege(PRIVILEGE.MOD);
const requireAdmin = authorizePrivilege(PRIVILEGE.ADMIN); 
// We can also define requireMod if needed: const requireMod = authorizePrivilege(PRIVILEGE.MOD);


app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

//AUTH
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 1) {
    return res.status(400).json({ error: 'Password must be at least 1 character long' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'User already exists' }); // 409 Conflict
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});


app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      // Ensure your query selects the necessary fields, including 'privileges'
      'SELECT id, name, email, privileges, password FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // --- Get the privilege level and include it in the payload ---
    const payload = { 
        id: user.id,
        name: user.name,
        email: user.email,
        privileges: user.privileges 
    };

    // Sign the Access Token
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '20s' })

    const refreshToken = jwt.sign(
      payload,
      REFRESH_SECRET,
      {
        expiresIn: '1min'
      }
    );

    const expirationSeconds = 7 * 24 * 60 * 60;
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    try {
        await pool.query(
            'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
            [refreshToken, user.id, expiresAt]
        );
        
        return res.status(200).json({
            success: true,
            message: 'Authentication successful',
            accessToken: accessToken,
            refreshToken: refreshToken,
            user: { id: user.id, name: user.name }
        });
    } catch (err) {
        console.error('Token storage error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// refresh token
app.post('/api/token/refresh', async (req, res) => {
  // client sends the expired Access Token AND the Refresh Token
  const { refreshToken } = req.body;

  if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh Token required' });
  }

  try {
    //if token is valid
    const tokenResult = await pool.query(
        `SELECT user_id, expires_at 
          FROM refresh_tokens 
          WHERE token = $1 AND expires_at > NOW()`,
        [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
        // token not found, or it is expired (DB check)
        return res.status(403).json({ error: 'Invalid, revoked, or expired Refresh Token.' });
    }
    
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    
    const userResult = await pool.query(
        'SELECT id, email, privileges FROM users WHERE id = $1',
        [tokenResult.rows[0].user_id] // use the user_id retrieved from the token table
    );
    
    const user = userResult.rows[0];

    const payload = { 
        id: user.id,
        name: user.name,
        email: user.email,
        privileges: user.privileges 
    };

    const newAccessToken = jwt.sign(
        payload,
        JWT_SECRET,
        { expiresIn: '10sec' }
    );

    return res.status(200).json({
        success: true,
        accessToken: newAccessToken,
        message: 'New Access Token granted.'
    });

  } catch (err) {
      console.error('Refresh Token verification failed:', err.message);
      // This catches generic JWT errors like signature failure
      return res.status(403).json({ error: 'Refresh token is invalid. Please log in again.' });
  }
});

//setting privileges can only be done by admin
app.put('/api/users/privileges', authenticateToken, requireAdmin, async (req, res) => {
  const { id, privileges } = req.body;

  if (!id || !privileges) {
    return res.status(400).json({ error: 'User ID and privileges are required' });
  }

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const result = await pool.query(
      'UPDATE users SET privileges = $1 WHERE id = $2 RETURNING id, privileges',
      [privileges, id]
    );

    res.status(200).json({
      success: true,
      message: 'Privileges updated successfully',
      user: result.rows[0],
    });
    console.log('Privileges updated for user:', id);
  } catch (err) {
      console.error('DB error updating privileges:', err);
      res.status(500).json({ success: false, error: 'Database error' });
  }
});

//only admin can view all users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Error querying database', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//update data - only self or admin
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  // must be self
  if (req.user.id != id && req.user.role < PRIVILEGE.ADMIN) {
      return res.status(403).json({ error: 'Access denied. You can only update your own account.' });
  }

  const { name, email, password } = req.body;

  if (!name && !email && !password) {
    return res.status(400).json({ error: 'At least one field (name, email, or password) is required' });
  }

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (name) {
      updates.push(`name = $${valueIndex++}`);
      values.push(name);
    }


    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (email) {
      updates.push(`email = $${valueIndex++}`);
      values.push(email);
    }

    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updates.push(`password = $${valueIndex++}`);
      values.push(hashedPassword);
    }

    values.push(id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${valueIndex}
      RETURNING id, name, email, privileges
    `;

    const result = await pool.query(query, values);

    res.status(200).json({
      message: 'User updated successfully',
      user: result.rows[0],
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }

    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

//anyone can view individual posts
app.get('/api/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.id, p.title, p.content, p.created_at,
             u.id as user_id, u.name as user_name, u.email as user_email, u.privileges
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = result.rows[0];
    const formattedPost = {
      id: post.id,
      title: post.title,
      content: post.content,
      createDate: post.created_at,
      poster: {
        id: post.user_id,
        name: post.user_name,
        email: post.user_email,
        privileges: post.privileges
      }
    };

    res.json(formattedPost);
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});   

//only moderators or admins can ban users
//NEEDS FIXING
app.delete('/api/users/:id', authenticateToken, requireModerator, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('BEGIN');

    const targetUserResult = await pool.query('SELECT id, privileges FROM users WHERE id = $1', [id]);
    if (targetUserResult.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const targetUserPrivileges = targetUserResult.rows[0].privileges;

    if (req.user.id == id) {
      await pool.query('ROLLBACK');
      return res.status(403).json({ error: 'Cannot delete your own account via this endpoint.' });
    }

    if (req.user.role < PRIVILEGE.ADMIN && targetUserPrivileges >= PRIVILEGE.ADMIN) {
      await pool.query('ROLLBACK');
      return res.status(403).json({ error: 'You do not have permission to delete this user (Admin protection).' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await pool.query('COMMIT');

    res.sendStatus(204);
  } catch (err) {
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback error:', rollbackErr);
    }
    console.error('DB delete error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
 

//POSTS
//requires login
app.post('/api/post', authenticateToken, async (req, res) => {
  const { title, content } = req.body;
  const userId = req.user.id;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  if (typeof title !== 'string' || typeof content !== 'string') {
    return res.status(400).json({ error: 'Invalid data types for title, content, or userId' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3) RETURNING id, title, content, user_id, created_at',
      [title, content, userId]
    );
    res.status(201).json({
      message: 'Post created successfully',
      post: result.rows[0],
    });
  } catch (err) {
    console.error('Failed to create post:', err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid userId — user does not exist' });
    }

    res.status(500).json({ error: 'Failed to create post' });
  }
});

const checkPostOwnership = async (req, res, next) => {
    const postId = req.params.id; // or req.body.postId for comments/updates

    try {
        const result = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const postOwnerId = result.rows[0].user_id;

        // Authorization Check: Owner OR Admin
        if (req.user.id === postOwnerId || req.user.role >= PRIVILEGE.ADMIN) {
            next(); // Authorized
        } else {
            return res.status(403).json({ error: 'Access denied. You are not the post owner.' });
        }
    } catch (err) {
        console.error('Ownership check error:', err);
        res.status(500).json({ error: 'Database error during authorization.' });
    }
};

const checkCommentOwnership = async (req, res, next) => {
    const commentId = req.params.id;

    try {
        const result = await pool.query('SELECT user_id FROM comments WHERE id = $1', [commentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const commentOwnerId = result.rows[0].user_id;

        // Authorization Check: Owner OR Admin
        if (req.user.id === commentOwnerId || req.user.role >= PRIVILEGE.ADMIN) {
            next(); // Authorized
        } else {
            return res.status(403).json({ error: 'Access denied. You are not the comment owner.' });
        }
    } catch (err) {
        console.error('Ownership check error:', err);
        res.status(500).json({ error: 'Database error during authorization.' });
    }
};

app.put('/api/posts/:id', authenticateToken, checkPostOwnership, async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Post ID is required in the URL' });
  }

  if (!title && !content) {
    return res.status(400).json({ error: 'At least one of title or content must be provided' });
  }

  if (title.length < 1 || content.length < 1) {
    return res.status(400).json({ error: 'Title must be at least 1 char long, content at least 1 char long' });
  }

  try {
    const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1', [id]);
    if (postCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (title) {
      updates.push(`title = $${valueIndex++}`);
      values.push(title);
    }
    if (content) {
      updates.push(`content = $${valueIndex++}`);
      values.push(content);
    }

    values.push(id);

    const query = `
      UPDATE posts
      SET ${updates.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING id, title, content, user_id
    `;

    const result = await pool.query(query, values);

    res.status(200).json({
      message: 'Post updated successfully',
      post: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating post:', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});


app.get('/api/posts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.title, p.content, p.created_at,
             u.id as user_id, u.name as user_name, u.email as user_email, u.privileges as user_privileges
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    const posts = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      poster: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        privileges: row.user_privileges
      },
      createDate: row.created_at
    }));

    res.json(posts);
  } catch (err) {
    console.error(err);
    console.log(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});   

app.delete('/api/posts/:id', authenticateToken, checkPostOwnership, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.sendStatus(204);
  } catch (err) {
    console.error('Failed to delete post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});


//COMMENTS
app.post('/api/comment', authenticateToken, async (req, res) => {
  const { content, postId } = req.body;
  const userId = req.user.id;

  if (!content || !postId) {
    return res.status(400).json({ error: 'content and postId are required' });
  }

  try {
    const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const result = await pool.query(
      'INSERT INTO comments (content, post_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [content, postId, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});


app.put('/api/comments/:id', authenticateToken, checkCommentOwnership, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Comment ID is required in the URL' });
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Valid comment content is required' });
  }

  try {
    const commentCheck = await pool.query('SELECT id FROM comments WHERE id = $1', [id]);
    if (commentCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const result = await pool.query(
      'UPDATE comments SET content = $1 WHERE id = $2 RETURNING id, content, post_id, user_id',
      [content, id]
    );

    res.status(200).json({
      message: 'Comment updated successfully',
      comment: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating comment:', err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});


app.get('/api/comments/:postId', async (req, res) => {
  const { postId } = req.params;
  try {
    const result = await pool.query(
      `SELECT c.id AS id, c.content, c.created_at, u.name, u.email, u.privileges, u.id AS user_id
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.post_id = $1 
       ORDER BY c.created_at ASC`,
      [postId]
    );
    if (result.rows.length === 0) {
      res.json([]);
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});  

app.delete('/api/comment/:id', authenticateToken, checkCommentOwnership, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM comments WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.sendStatus(204);
  } catch (err) {
    console.error('Failed to delete comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});


app.get('/', (req, res) => {
  res.send('DB ~');
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
