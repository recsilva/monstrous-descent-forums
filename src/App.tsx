// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import { motion, useTransform, useTime } from "framer-motion"
import { useEffect, useState } from 'react';
import Card from './components/card'
import { head } from "framer-motion/client";

function App() {

  type User = {
    id: number;
    name: string;
    email: string;
    privileges: number;
  };

  type Post = {
    id:number;
    title:string;
    content:string;
    poster:User;
    createDate:Date;
    comments: Comment[];
  }

  type Comment = {
    id: number;
    content: string;

    poster: User;
    created_at: Date;
  };   

  // const [users, setUsers] = useState<User[]>([]);

  const [loggedInUser, setLoggedInUser] = useState<User>();

  const [IsLogin, setIsLogin] = useState(false);
  const [IsRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const [editId, setEditId] = useState(0);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isViewingUsers, setIsViewingUsers] = useState(false);

  const [users, setUsers] = useState<User[]>([]);

  const [posts, setPosts] = useState<Post[]>([]);

  const [header, setHeader] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    getPosts()
  }, []);

  const time = useTime();
  const progress = useTransform(time, [0, 1500], [0, 1], {
    clamp: false,
  });

  const rotate = useTransform(progress, v => Math.sin(v * Math.PI) * 10);

  const handleRegister = async (name, email, password) => {
    try {
      const response = await fetch('https://db.weightedwalk.org/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log('Registration successful');
      } else {
        console.error('Registration failed:', data.error);
      }
    } catch (err) {
      console.error('Network error:', err);
    }
  };   

  const handleLogin = async (email, password) => {
    const res = await fetch('https://db.weightedwalk.org/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.success) {
      setLoggedInUser(data.user);
      return data.user;
    } else {
      alert(data.message);
      return null;
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const user = await handleLogin(email, password);
    console.log('Logging in with:', { email, password });

    if (user) {
      setLoggedInUser(user);
      setIsLogin(false);
    }
  };

  const modUser = async (id) => {
    try {
      const response = await fetch('https://db.weightedwalk.org/api/users/privileges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, privileges: 1 }),
      });
      if (!response.ok) throw new Error('Failed to mod user');
      else{
        getPosts()
      }
    } catch (err) {
      console.error('Error modding user:', err);
    }
  };

  const unmodUser = async (id) => {
    try {
      const response = await fetch('https://db.weightedwalk.org/api/users/privileges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, privileges: 0 }),
      });
      if (!response.ok) throw new Error('Failed to unmod user')
      else{
        getPosts()
      }
    } catch (err) {
      console.error('Error unmodding user:', err);
    }
  };

  const banUser = async (id) => {
    try {
      const response = await fetch(`https://db.weightedwalk.org/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to ban user')
      else{
        getPosts()
      }
    } catch (err) {
      console.error('Error banning user:', err);
    }
  };

  const getUsers = async () => {
    try {
      const res = await fetch('https://db.weightedwalk.org/api/users', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setUsers(data);
      setIsViewingUsers(true);
    } catch (err) {
      console.error('Error fetching users:', err);
      alert('Failed to load users.');
    }
  }

  
  const getPosts = async () => {
    console.log("getPosts")
    try {
      const response = await fetch('https://db.weightedwalk.org/api/posts');
      if (!response.ok) throw new Error('Failed to fetch');
      const postData = await response.json();

      const commentsPromises = postData.map(post =>
        fetch(`https://db.weightedwalk.org/api/comments/${post.id}`).then(res => res.json())
      );

      const commentsArrays = await Promise.all(commentsPromises); 


      // console.log('Comments arrays:', commentsArrays); // Log the entire response

      
      // Map the raw data to the Post type
      const posts: Post[] = postData.map((post, index) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        poster: {
          id: post.poster.id,
          name: post.poster.name,
          email: post.poster.email, 
          privileges: post.poster.privileges
        },
        createDate: post.createDate,
        comments: commentsArrays[index].map((comment: any) => ({
          id: comment.id,
          content: comment.content,
          poster: {
            id: comment.user_id, // or whatever field holds the user ID
            name: comment.name,  // assuming name is returned
            email: comment.email, // assuming email is returned
            privileges: comment.privileges // if available
          },
          created_at: new Date(comment.created_at)
        }))   
      })); 

      console.log(posts);
      setPosts(posts);
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!loggedInUser?.id) return;
    await postPost(header, body, loggedInUser.id);
    getPosts()
  };

  const postPost = async (title, content, posterId) => {
      try {
        const response = await fetch('https://db.weightedwalk.org/api/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, content, userId:posterId }),
        });

        const data = await response.json();
        if (response.ok) {
          console.log('Post successful');
        } else {
          console.error('Post failed:', data.error);
        }
      } catch (err) {
        console.error('Network error:', err);
      }
  };   

  const deletePost = async (id) => {
    try {
      const response = await fetch(`https://db.weightedwalk.org/api/post/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        getPosts()
        console.log('Delete successful');
      } else {
        console.error('Delete failed:', data.error);
      }
    } catch (err) {
      console.error('Network error:', err);
    }
  };   

  const deleteComment = async (id) =>{
    try {
      const response = await fetch(`https://db.weightedwalk.org/api/comment/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        getPosts()
        console.log('Delete successful');
      } else {
        console.error('Delete failed:', data.error);
      }
    } catch (err) {
      console.error('Network error:', err);
    }
  };


  const updateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`https://db.weightedwalk.org/api/users/${loggedInUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });
      

      const data = await response.json();
      if (response.ok) {
        loggedInUser.name = name;
        loggedInUser.email = email;

        console.log('Change successful');
        setLoggedInUser((prevUser) => {
          if (!prevUser) return prevUser;
          return {
            ...prevUser,
            name,
            email
          };
        })

      } else {
        console.error('Change failed:', data.error);
      }
    } catch (err) {
      console.error('Network error:', err);
    }
  };   


  const updateComment = async (e) =>{
    e.preventDefault();
    try {
      const response = await fetch(`https://db.weightedwalk.org/api/comments/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body }),
      });   

      const data = await response.json();
      if (response.ok) {
        getPosts()
        console.log('Comment edit successful');
      } else {
        console.error('Comment edit failed:', data.error);
      }
    } catch (err) {
      console.error('Network error:', err);
    }
  };

  const updatePost = async (e) =>{
    e.preventDefault();
    try {
      const response = await fetch(`https://db.weightedwalk.org/api/posts/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: header, content: body }),
      });   

      const data = await response.json();
      if (response.ok) {
        getPosts()
        console.log('Post edit successful');
      } else {
        console.error('Post edit failed:', data.error);
      }
    } catch (err) {
      console.error('Network error:', err);
    }
  };

  const handleCommentSubmit = async (content, postId) => {
    console.log("id: ", postId);
    console.log("content: ", content);
    await fetch('https://db.weightedwalk.org/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, postId, userId: loggedInUser.id }),
    });
  }

  // loadAllComments()
  // console.log(new Date(posts[0].createDate)); // Should now be valid   
  return (
    <>
      <header>
        <div className="text-right p-2">

          {
            loggedInUser ? (
              //else
              <>
                <div className="grid grid-cols-2 text-left">
                  <div>
                    <button onClick={(e)=>{e.preventDefault();setName(loggedInUser.name);setEmail(loggedInUser.email);setPassword('');setIsEditingProfile(true); console.log(isEditingProfile)}} className="text-pink-300 hover:text-pink-200 underline">edit profile</button> <button onClick={()=>{getUsers();setIsViewingUsers(true)}} className="underline text-pink-300 hover:text-pink-200">view all users</button>
                  </div>
                  <div className="text-right">
                    <h1 className="text-white">{"logged in as: " + loggedInUser.name + "(" + loggedInUser.email + ")" + " ID:"+ loggedInUser.id} <button onClick={()=>setLoggedInUser(undefined)}className="text-red-200 hover:text-red-400">logout</button>  </h1>
                  </div>
                  
                </div>

                {isViewingUsers && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-10 rounded shadow-lg max-h-[80vh] overflow-y-auto w-full max-w-3xl">
                      <h2 className="text-xl text-center mb-4">All Users</h2>
                      <table className="min-w-full table-auto border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border px-4 py-2 text-left">ID</th>
                            <th className="border px-4 py-2 text-left">Name</th>
                            <th className="border px-4 py-2 text-left">Email</th>
                            <th className="border px-4 py-2 text-left">Privileges</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                              <td className="border px-4 py-2">{user.id}</td>
                              <td className="border px-4 py-2">{user.name}</td>
                              <td className="border px-4 py-2">{user.email}</td>
                              <td className="border px-4 py-2">{user.privileges}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-4 flex justify-center">
                        <button
                          className="bg-red-200 text-white py-2 px-4 rounded hover:bg-red-400"
                          onClick={() => setIsViewingUsers(false)}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}


                {isEditingProfile && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-10 rounded shadow-lg">
                      <h2 className="text-xl text-center mb-4">Editing profile</h2>
                      {
                      <form onSubmit={(e) => {

                          updateUser(e);
                          setIsEditingProfile(false);

                        }} className="space-y-4">
                          <div>
                            <label htmlFor="name" className="block text-sm font-medium">
                              Name
                            </label>
                            <input
                              id="name"
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium">
                              Email
                            </label>
                            <input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="password" className="block text-sm font-medium">
                              Password
                            </label>
                            <input
                              id="password"
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-500"
                          >
                            Confirm changes
                          </button>
                        </form>   
                      }
                      <button className="w-1/2 m-1 bg-red-200 text-white py-2 rounded hover:bg-red-400" onClick={() => {setIsEditingProfile(false)}}>
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <button className="text-right text-pink-300 hover:text-pink-200 text-2xl" onClick={() => setIsLogin(true)}>login</button>
                
                {IsLogin && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-10 rounded shadow-lg">
                      <h2 className="text-xl text-center mb-4">Login</h2>
                      {
                      <form onSubmit={(e) => {

                          handleLoginSubmit(e);

                        }} className="space-y-4">
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium">
                              Email
                            </label>
                            <input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="password" className="block text-sm font-medium">
                              Password
                            </label>
                            <input
                              id="password"
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-500"
                          >
                            Login
                          </button>
                        </form>   
                      }
                      {/* <h2 className="text-xl text-center mb-4">Register</h2>
                      Add login form here */}
                      <div className="text-center text-red-200 hover:text-red-500" onClick={() => {setIsRegister(true); setIsLogin(false)}}><button>register instead</button></div>
                      <button className="w-1/2 m-1 bg-red-200 text-white py-2 rounded hover:bg-red-400" onClick={() => {setIsLogin(false); setIsRegister(false)}}>
                        Close
                      </button>
                    </div>
                  </div>
                )}
                {IsRegister && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-10 rounded shadow-lg">
                      <h2 className="text-xl text-center mb-4">Login</h2>
                      {
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          // Handle registration logic here

                          if (password !== confirmPassword) {
                            alert("Passwords don't match");
                            return;
                          }   
                          handleRegister(name, email, password)
                          console.log('Registering with:', { name, email, password });
                          // setIsRegister(false);
                          // setIsLogin(true);
                        }} className="space-y-4">
                          <div>
                            <label htmlFor="name" className="block text-sm font-medium">
                              Name
                            </label>
                            <input
                              id="name"
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium">
                              Email
                            </label>
                            <input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="password" className="block text-sm font-medium">
                              Password
                            </label>
                            <input
                              id="password"
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                          </div>
                          <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium">
                              Confirm Password
                            </label>
                            <input
                              id="confirmPassword"
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              required
                              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                            />
                            {password !== confirmPassword && confirmPassword && (
                              <p className="text-red-500 text-sm">Passwords do not match</p>
                            )}
                          </div>   
                          <button
                            type="submit"
                            className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-500"
                          >
                            Register
                          </button>
                        </form>   
                      }
                      {/* <h2 className="text-xl text-center mb-4">Register</h2>
                      Add login form here */}
                      <div className="text-center text-red-200 hover:text-red-500" onClick={() => {setIsRegister(false); setIsLogin(true)}}><button>login instead</button></div>
                      <button className="w-1/2 m-1 bg-red-200 text-white py-2 rounded hover:bg-red-400" onClick={() => {setIsLogin(false); setIsRegister(false)}}>
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </>
            )
          }
        </div>
      
      
      </header>
      <main>
        <h1 className="text-4xl text-white text-center font-bold m-10 mt-0 pt-10"> <img className=" size-15 m-auto inline" src="/public/icon.png"></img> Monstrous Descent </h1>
        <motion.p
          style={{ rotate }}
          whileHover={{
            scale: 1.3
          }}
          // animate={{
          //   rotate: Math.cos(time)
          // }}
          className='text-3xl text-white font-bold text-center w-full m-auto' > (freshly out of the oven!)</motion.p >
        <p className="text-2x1 text-white m-5 text-center">up for grabs now</p>

        <video controls className="m-auto w-500">
          <source src="/src/assets/vid.mp4" type="video/mp4" />
        </video>



        <p className="text-2xl text-red-50 text-center font-bold"> 
          <a className="text-pink-300 underline text-center" href="https://github.com/WeightedWalk/MonstrousDescent/releases/tag/v0.4.0-alpha">TRY IT!!</a>
        </p>
        <p className="text-white text-center"> and give us feedback to make the game the greatest it can be</p>
        <div className="grid lg:grid-cols-3 md:grid-cols-1 gap-4">
          <article className="text-left text-white p-5 col-span-2">
            <div className="m-auto text-white row-span-5 space-y-4 max-w-3xl">
              <h2 className="text-2xl text-white text-center"><strong>Posts</strong>              
                <button 
                  onClick={() => getPosts()}
                  className=" pl-3 text-pink-200 hover:text-pink-400 underline px-2">
                  update
                </button>
              
              {loggedInUser && (
                <button 
                  onClick={() => {setBody(''); setHeader(''); setIsCreatingPost(true)}}
                  className=" text-pink-200 hover:text-pink-400 underline px-2">
                  new
                </button>
              )}</h2>

              {isCreatingPost && (
                <div className="text-black fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white w-3xl p-2 rounded shadow-lg">
                    <h2 className="text-xl text-center mb-4">New post</h2>
                    
                    {
                    <form onSubmit={(e) => {

                        handlePostSubmit(e);
                        setIsCreatingPost(false);

                      }} className="space-y-4">
                        <div>
                          <label htmlFor="header" className="block text-sm font-medium">
                            Title
                          </label>
                          <input
                            id="header"
                            type="header"
                            value={header}
                            onChange={(e) => setHeader(e.target.value)}
                            required
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                          />
                        </div>
                        <div>
                          <label htmlFor="body" className="block text-sm font-medium">
                            Body
                          </label>
                          <textarea
                            id="body"
                            type="body"
                            value={body}
                            rows="3"
                            onChange={(e) => setBody(e.target.value)}
                            required
                            className="w-full px-3 h-100 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-500"
                        >
                          Post
                        </button>
                      </form>   
                    }
                    {/* <h2 className="text-xl text-center mb-4">Register</h2>
                    Add login form here */}
                    <button className="w-1/2 m-1 bg-red-200 text-white py-2 rounded hover:bg-red-400 mt-3" onClick={() => {setIsCreatingPost(false)}}>
                      Close
                    </button>
                  </div>
                </div>
              )}

              {isEditingPost && (
                <div className="text-black fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white w-3xl p-2 rounded shadow-lg">
                    <h2 className="text-xl text-center mb-4">Editing post</h2>
                    
                    {
                    <form onSubmit={(e) => {

                        updatePost(e);
                        setIsEditingPost(false);

                      }} className="space-y-4">
                        <div>
                          <label htmlFor="header" className="block text-sm font-medium">
                            Title
                          </label>
                          <input
                            id="header"
                            type="header"
                            value={header}
                            onChange={(e) => setHeader(e.target.value)}
                            required
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                          />
                        </div>
                        <div>
                          <label htmlFor="body" className="block text-sm font-medium">
                            Body
                          </label>
                          <textarea
                            id="body"
                            type="body"
                            value={body}
                            rows="3"
                            onChange={(e) => setBody(e.target.value)}
                            required
                            className="w-full px-3 h-100 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-500"
                        >
                          Post
                        </button>
                      </form>   
                    }
                    {/* <h2 className="text-xl text-center mb-4">Register</h2>
                    Add login form here */}
                    <button className="w-1/2 m-1 bg-red-200 text-white py-2 rounded hover:bg-red-400 mt-3" onClick={() => {setIsEditingPost(false)}}>
                      Close
                    </button>
                  </div>
                </div>
              )}

              {isEditingComment && (
                <div className="text-black fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white w-3xl p-2 rounded shadow-lg">
                    <h2 className="text-xl text-center mb-4">Editing comment</h2>
                    
                    {
                    <form onSubmit={(e) => {

                        updateComment(e);
                        setIsEditingComment(false);

                      }} className="space-y-4">
                        <div>
                          <textarea
                            id="body"
                            type="body"
                            value={body}
                            rows="3"
                            onChange={(e) => setBody(e.target.value)}
                            required
                            className="w-full px-3 h-100 py-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-500"
                        >
                          Save
                        </button>
                      </form>   
                    }
                    {/* <h2 className="text-xl text-center mb-4">Register</h2>
                    Add login form here */}
                    <button className="w-1/2 m-1 bg-red-200 text-white py-2 rounded hover:bg-red-400 mt-3" onClick={() => {setIsEditingComment(false)}}>
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* {
                console.log(loggedInUser)
              } */}
              {posts.map((post) => (
                <article key={post.id} className="bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-xl font-semibold text-white mb-2">{post.title}</h3>
                  <p className="text-gray-300 mb-4">{post.content}</p>

                  <div className="grid grid-cols-2">
                    <div className="text-sm text-gray-500">
                      by {post.poster.name} • {new Date(post.createDate).toLocaleString()}
                    </div>
                    <div className="text-sm text-right">
                      {loggedInUser && (
                        <>
                          {((loggedInUser.id != post.poster.id && post.poster.id && post.poster.privileges < 1 && loggedInUser.privileges >= 1) || loggedInUser.privileges >= 2 && loggedInUser.id != post.poster.id) &&(
                            <>
                              [ {' '}
                                {loggedInUser.privileges >= 2 && loggedInUser.id != post.poster.id && (
                                  <>
                                  {post.poster.privileges == 1 && (
                                    <button className="text-red-200 hover:text-red-400" onClick={(e)=>{e.preventDefault();unmodUser(post.poster.id)}}>
                                      unmod
                                    </button>
                                  )}
                                  {post.poster.privileges == 0 && (
                                      <>
                                        {loggedInUser.id != post.poster.id && (
                                          <>
                                            <button className="text-red-200 hover:text-red-400" onClick={(e)=>{e.preventDefault();modUser(post.poster.id)}}>
                                              mod
                                            </button>
                                          </>
                                        )}
                                      </>
                                  )}
                                  </>
                                )}

                                {loggedInUser.id != post.poster.id &&(
                                  <>
                                    {loggedInUser.privileges >= 2 && (
                                      <>{' | '}</>
                                    )}
                                      <button className="text-red-200 hover:text-red-400" onClick={(e)=>{e.preventDefault();banUser(post.poster.id)}}>
                                        ban
                                      </button> ]{' '}-{' '}
                                  </>
                                )}

                            </>
                          )}
                          
                        
                      
                      {loggedInUser && (loggedInUser.privileges >= 1 || loggedInUser.id === post.poster.id ) && (
                        <>
                        [{' '}
                          {loggedInUser.privileges >= 1 && (
                            <button className="text-red-200 hover:text-red-400" onClick={()=>deletePost(post.id)}>
                              delete
                            </button> 
                          )}
                          {loggedInUser.privileges >= 1 && loggedInUser.id === post.poster.id && (
                            <button key="separator" className="mx-1">
                              |
                            </button>
                          )}
                          {loggedInUser.id == post.poster.id && (
                            <button className="text-red-200 hover:text-red-400" onClick={()=>{setEditId(post.id); setIsEditingPost(true); setHeader(post.title); setBody(post.content)}}>
                              edit
                            </button>)}
                        {' '}]
                        </>
                      )}
                        </>
                      )}
                      
                      </div>
                  </div>


                  {
                    post.comments.map(comment => (
                      <div key={comment.id} className="ml-4 mt-2 text-sm">
                        <strong>{comment.poster.name} </strong>({new Date(comment.created_at).toLocaleTimeString()}) 
                        
                        {loggedInUser && (loggedInUser.id == comment.poster.id || loggedInUser.privileges >= 1) &&(
                        <>[
                          {" "}
                          
                          {loggedInUser.privileges >= 2 && loggedInUser.id != comment.poster.id && (
                            <button className="text-red-200 hover:text-red-400" onClick={(e)=>{e.preventDefault();banUser(comment.poster.id)}}>
                              ban
                            </button>
                          )}

                          {loggedInUser.privileges >= 2 && loggedInUser.id != comment.poster.id && (<>{' '}]{' '}-{' '}[{' '}</>)}

                          {loggedInUser && loggedInUser.privileges >= 1 &&(
                            <button onClick={()=>deleteComment(comment.id)}className="text-sm text-right text-red-200 hover:text-red-400">delete
                            </button>
                          )}
                          
                          {loggedInUser && loggedInUser.privileges >= 1 && loggedInUser.id == comment.poster.id &&(
                            <> | </>
                          )}

                          {loggedInUser && loggedInUser.id == comment.poster.id &&(
                            <button className="text-red-200 hover:text-red-400" onClick={()=>{setEditId(comment.id);setBody(comment.content); setIsEditingComment(true);}}>
                              edit
                            </button>
                          )}
                        {" "}
                        ]</>
                        )}
                        
                         :  {comment.content}
                      </div>
                    ))
                  }
{/* 
                  <CommentForm 
                    postId={post.id} 
                    onCommentSubmit={(content) => handleCommentSubmit(content, post.id)} 
                  />    */}

                  {loggedInUser ? (
                    <CommentForm 
                      postId={post.id} 
                      onCommentSubmit={async (content) => {await handleCommentSubmit(content,post.id);getPosts()}} 
                    />   

                  ):(
                    <div className="mt-5">
                      must be logged in to leave comments
                    </div>
                  )}
                </article>
              ))}
              {/* {console.log(posts[0].createDate.toString())}    */}
            </div>   

            <div className="m-auto text-white row-span-5 space-y-4 max-w-3xl">
              <h2 className="text-2xl mt-5 text-white text-center "><strong>Setting</strong></h2>
              <p>
                You are a <strong>lone shadow</strong> in an unknown <em>everchanging</em> world still clinging to <em>hope</em> <br />
                .. that you can save what is left of the world from <em>suffering</em> the same fate.
                <br />
                You no longer have the guarantee of flesh, therefore your influence on the world you inhabit is limited.
                You need to rely on your hosts.... 
                <br/>
              </p>
              
              <p className="pl-10">
                <li>Gain control of new beasts</li>
                <li>Command your hosts</li>
                <li>Manage your sanity</li>
                <li>Explore unique landscapes</li>
                <li>Manage risk and reward</li>
                <li>Keep moving or face consiquences</li>
              </p>
              <p>
                  ...until you fail once more....
              </p>

              <h2 className="text-2xl text-white text-center "><strong>About</strong></h2>

              <div>
                <h3 className="left">The permadeath survival rouguelike creature collector of your wet dreams
                  - <strong>Monstrous Descent</strong> is <em>coming</em> to a store near you!</h3>
                <p>wishlist it on steam <a className="underline text-pink-300" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">here</a> (we are not on steam yet)</p>

                <section className="p-5 text-white">
                  <p>upcoming features:</p>
                  <ul className="list-disc p-5" >
                    <li>open world like level traversal</li>
                    <li className="list">unique monster skill trees</li>
                    <li>more monsters ++</li>
                    <li>monster nests and natural migration</li>
                    <li>unique scenarios, formed naturally by monster migration and objectives</li>
                    <li>the shadow sanity system</li>
                    <li>different ways to interact with the world based on previous decisions and playstyle</li>
                    <li>the shadows reactions to events that differ based on playstyle</li>
                    <li><em>intelligent</em> monster ai <sub>this one will be here for a while</sub></li>
                  </ul>
                </section>
              </div>
            </div>
          </article>
          <div className="hidden md:grid text-center h-200 p-5 grid grid-rows-6 ">
            <h3 className="text-2xl text-white"><strong>Cards</strong></h3>
            <div className="grid grid-cols-auto relative row-span-5">
              <Card name="Lupernix" imgsrc="" bio="" identifier={0}></Card>
              <Card name="Spiquida" imgsrc="" bio="" identifier={1}></Card>
              <Card name="Ruperion" imgsrc="/src/assets/ruperion.png" bio="this one has chonk and the way he move those hips makes his foe fall head over heels" identifier={2}></Card>
              <Card name="Nomax" imgsrc="/src/assets/nomax.png" bio="my boy got the flame inim fr fr where he spittin' noone livin'" identifier={3}></Card>
            </div>
          </div>
        </div>
      </main>
      <footer>
        <p className="m-10 text-center text-white">©Copyright 2025 <strong>WeightedWalk</strong>. All rights reserved.</p>
        <p className="m-15 mb-0 pb-10 text-center text-white">tech used for website: react.js with vite, typescript, tailwind.css, framer-motion</p>
      </footer>
    </>
  )
}

function CommentForm({ postId, onCommentSubmit }) {
  const [content, setContent] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (content != ''){
      console.log("sending: ", content);
      onCommentSubmit(content, content);
      setContent('');
    }
    else{
      alert("comment cannot be empty");
    }
  };
  if (isCommenting){
    return (
      
      <form onSubmit={handleSubmit} className="mt-4">
        <textarea
          value={content}
          onChange={(e) => {setContent(e.target.value)}}
          placeholder="Add a comment..."
          className="w-full p-2 border rounded"
          rows="3"
        />
        <button type="submit" className="mt-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-1 rounded">
          Comment
        </button>
        <div className="text-left pt-3"><button className="text-sm text-red-200 hover:text-red-400" onClick={()=>setIsCommenting(false)}>cancel</button></div>
      </form>
    );
  }
  else
    return (<div className="text-left pt-3"><button className="text-sm text-red-200 hover:text-red-400" onClick={()=>setIsCommenting(true)}>comment</button></div>)

}

export default App
