/**
 * Centralized location for all Cloudinary URLs used in the project
 * All URLs are from the paalaleks Cloudinary account
 */

export const CLOUDINARY_URLS = {
  GRAINY:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745715093/grainy_fxayrt.png",
  RECORD:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745562792/discovered/vinyl_jan4n8.png",
  BG_GRAIN:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745548075/discovered/grain_ftttmu.png",
  HEADER:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745647784/header_xebbau.png",
  HEADER1:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745465652/discovered/header1_bfi8bt.png",
  HEADER2:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745465663/discovered/header2_uwxmbb.png",
  SECTION1:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745461127/discovered/section1_iveooh.png",
  SECTION2:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745742946/Mask_Group_47_cplrap.png",
  SECTION3:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745461126/discovered/section3_rdoqwo.png",
  DISC: "https://res.cloudinary.com/paalaleks/image/upload/v1744346399/discovered/disc_iylvf2.png",
  LOGO: "https://res.cloudinary.com/paalaleks/image/upload/v1745463919/discovered/logo_sp4oen.png",
  VINYL_PLACEHOLDER:
    "https://res.cloudinary.com/paalaleks/image/upload/v1745463919/discovered/vinyl_placeholder_zqzqzq.png",
} as const;

/**
 * Type representing all available Cloudinary URLs
 */
export type CloudinaryUrl =
  (typeof CLOUDINARY_URLS)[keyof typeof CLOUDINARY_URLS];
