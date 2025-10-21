// index.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const bcrypt = require('bcrypt');   

const app = express();
const port = process.env.PORT || 5000;

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
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
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

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        privileges: user.privileges,
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/users/privileges', async (req, res) => {
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


app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Error querying database', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
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


app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('BEGIN');

    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
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
app.post('/api/post', async (req, res) => {
  const { title, content, userId } = req.body;

  if (!title || !content || !userId) {
    return res.status(400).json({ error: 'Title, content, and userId are required' });
  }
  if (typeof title !== 'string' || typeof content !== 'string' || typeof userId !== 'number') {
    return res.status(400).json({ error: 'Invalid data types for title, content, or userId' });
  }
  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
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


app.put('/api/posts/:id', async (req, res) => {
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

app.delete('/api/posts/:id', async (req, res) => {
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
app.post('/api/comment', async (req, res) => {
  const { content, postId, userId } = req.body;

  if (!content || !postId || !userId) {
    return res.status(400).json({ error: 'content, postId, and userId are required' });
  }

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

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


app.put('/api/comments/:id', async (req, res) => {
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

app.delete('/api/comment/:id', async (req, res) => {
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
