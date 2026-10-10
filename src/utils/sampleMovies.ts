import { MediaItem } from '../types/media';

export interface SampleMovie {
  id: string;
  title: string;
  description: string;
  duration: number; // approximate seconds
  url: string;
  category: string;
  thumbnailGradient: string;
}

export const SAMPLE_MOVIES: SampleMovie[] = [
  {
    id: 'sample-bunny',
    title: 'Big Buck Bunny (Animation)',
    description: 'Classic open-source animated short film by the Blender Institute.',
    duration: 596,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    category: 'Animation / Comedy',
    thumbnailGradient: 'from-amber-600/40 via-orange-800/20 to-zinc-950',
  },
  {
    id: 'sample-steel',
    title: 'Tears of Steel (Sci-Fi Action)',
    description: 'Post-apocalyptic sci-fi visual effects showcase set in futuristic Amsterdam.',
    duration: 734,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    category: 'Sci-Fi / Action',
    thumbnailGradient: 'from-cyan-600/40 via-sky-900/20 to-zinc-950',
  },
  {
    id: 'sample-sintel',
    title: 'Sintel (Fantasy Quest)',
    description: 'Emotional fantasy quest of a lonely girl searching for a baby dragon.',
    duration: 888,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    category: 'Fantasy / Adventure',
    thumbnailGradient: 'from-purple-600/40 via-indigo-900/20 to-zinc-950',
  },
  {
    id: 'sample-blazes',
    title: 'For Bigger Blazes (Action Demo)',
    description: 'High-energy cinematic demonstration reel with vivid lighting.',
    duration: 15,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    category: 'Showreel / 4K',
    thumbnailGradient: 'from-rose-600/40 via-red-900/20 to-zinc-950',
  },
];

export function createMediaItemFromSample(sample: SampleMovie): MediaItem {
  return {
    id: `sample-${sample.id}-${Date.now()}`,
    name: sample.title,
    url: sample.url,
    size: 0,
    type: 'video/mp4',
    extension: 'mp4',
    isVideo: true,
    isAudio: false,
    duration: sample.duration,
    isDemo: true,
    bookmarks: [],
  };
}
