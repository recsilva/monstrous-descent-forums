// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import { motion, useTransform, useTime } from "framer-motion"
import Card from './components/card'

function App() {

  const time = useTime();
  const progress = useTransform(time, [0, 1500], [0, 1], {
    clamp: false,
  });

  const rotate = useTransform(progress, v => Math.sin(v * Math.PI) * 10);

  return (
    <>
      <header>

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
              <h2 className="text-2xl text-white text-center "><strong>Setting</strong></h2>
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

export default App
