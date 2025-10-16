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
  
  try {
    // Check if user already exists
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
  }
  catch(err){
    res.status(500).json({ error: 'check failed' });
  }
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    try {

    // Save new user
    await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
      [name, email, hashedPassword]
    );

    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'insert failed' });
  }
});   

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      // Email not found
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Compare the provided password with the hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Login successful
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
  try {
    await pool.query('UPDATE users SET privileges = $1 WHERE id = $2', [privileges, id]);
    res.status(200).json({ success: true });
    console.log("success")
  } catch (err) {
    res.status(500).json({ success: false, error: 'DB error' });
    console.error("failure: ", res)
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
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, privileges',
      [name, email, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
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
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await pool.query('COMMIT');
    res.status(200).json({ success: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('DB delete error:', err); // Log full error
    res.status(500).json({ success: false, error: err.message });
  }
});   

//POSTS
app.post('/api/post', async (req, res) => {
  const { title, content, userId } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3) RETURNING *',
      [title, content, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});   

app.put('/api/posts/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    await pool.query(
      'UPDATE posts SET title = $1, content = $2 WHERE id = $3',
      [title, content, id]
    );
    res.status(200).json({ message: 'Post updated' });
  } catch (err) {
    console.error(err);
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
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});   

app.delete('/api/post/:id', async (req, res) => {
  const { id } = req.params; // Get id from URL parameter
//   console.error(id);
  try {
    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.status(200).json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});   

//COMMENTS
app.post('/api/comment', async (req, res) => {
  const { content, postId, userId } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO comments (content, post_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [content, postId, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});  

app.put('/api/comments/:id', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  try {
    await pool.query(
      'UPDATE comments SET content = $1 WHERE id = $2',
      [content, id]
    );
    res.status(200).json({ message: 'Post updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update post' });
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
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});  

app.delete('/api/comment/:id', async (req, res) => {
  const { id } = req.params; // Get id from URL parameter
//   console.error(id);
  try {
    const result = await pool.query(
      'DELETE FROM comments WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    res.status(200).json({ message: 'Comment deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});   

app.get('/', (req, res) => {
  res.send('DB ~');
});


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
