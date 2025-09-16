import { motion } from 'framer-motion'

type cardProps = {
    identifier: number,
    name: string,
    imgsrc: string,
    bio: string,
}

function card(props: cardProps) {
    const topMap: { [key: number]: string } = {
        0: 'top-0',
        1: 'top-15',
        2: 'top-30',
        3: 'top-45',
    };

    const rightMap: { [key: number]: string } = {
        0: 'left-15',
        1: 'left-5',
        2: 'right-5',
        3: 'right-15',
    };

    const top = topMap[props.identifier];
    const right = rightMap[props.identifier];

    return (
        <motion.div
            whileHover={{
                scale: 1.1,
                zIndex: 2,
            }}
            // className={`m-auto w-80 h-120 border-2 rounded-2xl absolute inset-x-0 ${top} ${right} shadow-lg/90 grid grid-rows-8
            // size-18 bg-radial-[at_25%_25%] from-red-200 to-indigo-900 to-90%`}>
            className={`m-auto w-80 h-120 border-2 rounded-2xl absolute inset-x-0 ${top} ${right} shadow-lg/90 grid grid-rows-8
        size-18 bg-radial-[at_25%_25%] from-green-900 to-black to-90%`}>
            <div className="m-2 border-2 rounded-2xl bg-white shadow-lg/50">
                <h3 className=' text-3xl '><strong>{props.name}</strong></h3>
            </div>
            <div className=" row-span-5 m-2 mt-0 rounded-2xl border-2 flex items-center justify-center bg-black shadow-lg/50">
                {loadImage(props.imgsrc)}
            </div>
            <div className=" row-span-2 m-2 mt-0 border-2 rounded-2xl flex items-center bg-white shadow-lg/50">
                {loadBio(props.bio)}
            </div>
        </motion.div>
    )
}

function loadImage(src: string) {
    if (src == "") {
        // console.log("a")
        return <p className=' text-5xl rotate-45 text-center m-auto align-middle'>no visual</p>
    }
    else {
        // console.log("b")
        return <img className=' -scale-x-100' src={src}></img>
    }
}

function loadBio(bio: string) {
    if (bio == "") {
        return <p className='m-4'>no bio</p>
    }
    else {
        return <p className='m-4'> {bio} </p>
    }
}

export default card;