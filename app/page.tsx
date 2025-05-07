import Image from "next/image";
import { CLOUDINARY_URLS } from "@/lib/cloudinary-urls";
import { RiSpotifyFill } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/nav";

export default async function Home() {
  return (
    <div className="max-w-screen-xl w-full h-full relative bg-sandLight">
      <Nav />

      <div className="absolute top-0 left-0 w-full h-full z-0 noise" />
      <div className=" relative">
        <div className="absolute top-0 left-0 w-full h-full z-10 bg-linear-[170deg,_var(--teal-dark)_25%,_oklch(from_var(--seafoam-green)_l_c_h_/_0.4)_50%,_transparent_70%,_transparent_100%]" />

        <header className="w-full  flex flex-col justify-center z-10 relative pt-28 pb-16 ">
          <div className="max-w-[55rem] sm:max-w-[53rem] px-4 sm:px-6 mx-auto ">
            <div className="relative z-10">
              <Image
                src={CLOUDINARY_URLS.HEADER}
                alt="Discover"
                width={1000}
                height={1000}
                className="rounded-l-full overflow-hidden"
              />
              <div className="aspect-square absolute top-0 left-0 w-full h-full z-10">
                <div className="absolute top-1/2 left-[53%] transform -translate-x-1/4 -translate-y-1/2 flex gap-5  flex-col justify-center items-center">
                  <h1 className="text-center text-[clamp(2.4rem,9vw,5.5rem)] lg:text-[5.5rem] leading-[clamp(1.7rem,8vw,4.5rem)] font-black">
                    Discover Curated Playlists
                  </h1>
                  <p className="text-center text-[clamp(1.1rem,3vw,2rem)] lg:text-[2rem] leading-[clamp(1.5rem,3.8vw,2.5rem)] hidden xs:block px-4 font-medium">
                    Discover music outside the algorithms.
                  </p>

                  <p className="flex items-center gap-2 text-center text-[clamp(0.8rem,2.5vw,1.2rem)] leading-[clamp(1.5rem,2vw,1.6rem)]">
                    <RiSpotifyFill className="text-spotifyGreen" size={20} />
                    Discover in Spotify
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid place-content-start grid-cols-12 px-4 sm:px-6 max-w-[55rem] sm:max-w-[53rem] mx-auto z-10 relative ">
          <div className="z-10 relative row-start-1 col-span-10 col-start-2 h-fit mb-0 sm:mb-8">
            <div className="flex flex-col gap-5 px-5 text-center text-balance  max-w-2xl mx-auto">
              <h2 className="text-[clamp(2rem,5.6vw,3rem)] leading-[clamp(2rem,5.4vw,2.7rem)] font-black text-foreground mx-auto">
                Music from new sources
              </h2>
              <div className="text-[clamp(1.2rem,2.7vw,1.3rem)] leading-[clamp(1.4rem,5vw,2rem)] text-pretty font-medium">
                <p>
                  Machine learning is in many ways great, but sometimes
                  we&apos;d like to take a leap into something new musically and
                  head into a different direction. And did you know we could
                  actually be crow sourcing good music?
                </p>
              </div>
            </div>
          </div>
          <div className="sm:col-span-9 sm:col-start-1 row-start-3 sm:row-start-2 col-span-10 col-start-2">
            <Image
              src={CLOUDINARY_URLS.SECTION1}
              alt="Discover"
              width={1000}
              height={1000}
              className="w-full h-full object-cover object-right-top rounded-[3rem] relative z-10 "
            />
          </div>
          <div className="sm:col-span-3 col-span-12 sm:col-start-10 row-start-2 sm:row-start-2 flex items-center justify-center my-8 sm:mt-0 sm:mb-0">
            <ul className="gap-4 xs:gap-8 items-center text-center text-pretty flex sm:flex-col flex-row justify-center text-[clamp(0.8rem,2vw,1.2rem)]  font-bold">
              <li className="flex items-center gap-2 text-pretty flex-col ">
                <Image
                  src={CLOUDINARY_URLS.RECORD}
                  alt="Discover"
                  width={50}
                  height={50}
                  className="w-7 h-7 opacity-85"
                />
                <p>
                  More playlist <br /> followers
                </p>
              </li>
              <li className="flex items-center gap-2 text-pretty flex-col ">
                <Image
                  src={CLOUDINARY_URLS.RECORD}
                  alt="Discover"
                  width={50}
                  height={50}
                  className="w-7 h-7 opacity-85"
                />
                <p>
                  Play music right <br /> inside the app
                </p>
              </li>
              <li className="flex items-center gap-2 text-pretty flex-col ">
                <Image
                  src={CLOUDINARY_URLS.RECORD}
                  alt="Discover"
                  width={50}
                  height={50}
                  className="w-7 h-7 opacity-85"
                />
                <p>
                  Shuffle curated <br /> playlists
                </p>
              </li>
            </ul>
          </div>
        </section>
      </div>
      <div className=" relative w-full mt-16 max-w-5xl mx-auto min-h-[500px]">
        <div className="absolute top-0 left-0 w-full h-full z-10 bg-linear-[174deg,_transparent_20%,_oklch(from_var(--seafoam-green)_l_c_h_/_0.4)_45%,_var(--teal-dark)_100%]" />
        <section className="w-full px-4 sm:px-6 max-w-[55rem] sm:max-w-[53rem] mx-auto z-10 relative grid grid-cols-11  items-center">
          <div className="bg-gradient-to-br from-peach to-sandLight to-70% rounded-[3rem] overflow-hidden col-span-6">
            <Image
              src={CLOUDINARY_URLS.SECTION2}
              alt="Discover"
              width={500}
              height={500}
              className="object-cover w-full h-full object-right rounded-[3rem] relative z-10 "
            />
          </div>

          <div className="col-span-4 flex flex-col gap-4 justify-center items-center relative right-2 sm:right-4 max-w-[190px] w-full z-10">
            <h3 className="text-[clamp(1.2rem,3vw,1.5rem)] leading-[clamp(1.2rem,4vw,2.2rem)] font-bold text-center">
              Login with Spotify to get started
            </h3>

            <Button className="w-full shadow-sm" size={"lg"}>
              <RiSpotifyFill className="!w-5 !h-5 text-spotifyGreen" /> Login to
              Spotify
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
