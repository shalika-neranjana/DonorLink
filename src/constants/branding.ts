/**
 * Single place for brand assets and copy. Components import from here instead
 * of hard-coding image paths or the tagline.
 */
export const brand = {
  name: 'DonorLink',
  tagline: 'Find compatible blood donors, fast.',
  logo: require('../../assets/images/donorlink-logo.png') as number,
  supportEmail: 'support@donorlink.app',
} as const;
