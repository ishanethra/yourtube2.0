const curatedSampleVideos = [
  { _id: "music-1", videotitle: "Lo-fi Radio for Coding", videochanel: "Lofi Girl", views: 12000000, createdAt: "2026-01-10T10:00:00.000Z", youtubeId: "jfKfPfyJRdk", category: "Music", uploader: { _id: "ch-lofi-girl", name: "Lofi Girl", image: "https://yt3.googleusercontent.com/ytc/AIdro_mK_WfT6X2G7J6G7-j9S9S-d5_9999=s176-c-k-c0x00ffffff-no-rj" } },
  { _id: "music-2", videotitle: "Ambient Focus Stream", videochanel: "Study Beats", views: 4100000, createdAt: "2025-11-02T10:30:00.000Z", youtubeId: "5qap5aO4i9A", category: "Music", uploader: { _id: "ch-study-beats", name: "Study Beats" } },

  { _id: "gaming-1", videotitle: "Minecraft Survival Guide", videochanel: "GameHub", views: 1850000, createdAt: "2025-10-10T10:00:00.000Z", youtubeId: "MmB9b5njVbA", category: "Gaming", uploader: { _id: "ch-gamehub", name: "GameHub" } },
  { _id: "gaming-2", videotitle: "Competitive FPS Tips", videochanel: "eSports Pulse", views: 1180000, createdAt: "2025-12-09T13:30:00.000Z", youtubeId: "2g811Eo7K8U", category: "Gaming", uploader: { _id: "ch-esports-pulse", name: "eSports Pulse" } },

  { _id: "movies-1", videotitle: "Big Buck Bunny (Short Film)", videochanel: "Blender Foundation", views: 3300000, createdAt: "2025-12-01T08:00:00.000Z", youtubeId: "aqz-KE-bpKQ", category: "Movies", uploader: { _id: "ch-blender", name: "Blender Foundation" } },
  { _id: "movies-2", videotitle: "Storytelling Breakdown", videochanel: "FilmScope", views: 760000, createdAt: "2025-07-14T15:00:00.000Z", youtubeId: "M7lc1UVf-VE", category: "Movies", uploader: { _id: "ch-filmscope", name: "FilmScope" } },

  { _id: "news-1", videotitle: "Global Headlines Brief", videochanel: "World Update", views: 640000, createdAt: "2026-02-01T06:00:00.000Z", youtubeId: "M7lc1UVf-VE", category: "News", uploader: { _id: "ch-world-update", name: "World Update" } },
  { _id: "news-2", videotitle: "Market and Tech Roundup", videochanel: "NewsWire", views: 720000, createdAt: "2026-01-05T06:30:00.000Z", youtubeId: "jNQXAC9IVRw", category: "News", uploader: { _id: "ch-newswire", name: "NewsWire" } },

  { _id: "sports-1", videotitle: "Top Cricket Moments", videochanel: "Sports Arena", views: 2200000, createdAt: "2025-12-22T14:00:00.000Z", youtubeId: "UceaB4D0jpo", category: "Sports", uploader: { _id: "ch-sports-arena", name: "Sports Arena" } },
  { _id: "sports-2", videotitle: "Football Skills Session", videochanel: "Goal Studio", views: 1800000, createdAt: "2025-11-18T14:30:00.000Z", youtubeId: "ScMzIvxBSi4", category: "Sports", uploader: { _id: "ch-goal-studio", name: "Goal Studio" } },

  { _id: "tech-1", videotitle: "Next.js in 100 Seconds", videochanel: "Fireship", views: 2400000, createdAt: "2025-11-14T12:00:00.000Z", youtubeId: "Sklc_fQBmcs", category: "Technology", uploader: { _id: "ch-fireship", name: "Fireship" } },
  { _id: "tech-2", videotitle: "React Crash Course", videochanel: "Traversy Media", views: 1300000, createdAt: "2025-12-05T18:45:00.000Z", youtubeId: "w7ejDZ8SWv8", category: "Technology", uploader: { _id: "ch-traversy", name: "Traversy Media" } },

  { _id: "comedy-1", videotitle: "Standup Highlights", videochanel: "Laugh Factory", views: 920000, createdAt: "2025-08-19T20:00:00.000Z", youtubeId: "ScMzIvxBSi4", category: "Comedy", uploader: { _id: "ch-laugh-factory", name: "Laugh Factory" } },
  { _id: "comedy-2", videotitle: "Improv Reactions", videochanel: "Comedy Hub", views: 610000, createdAt: "2025-10-06T19:00:00.000Z", youtubeId: "jNQXAC9IVRw", category: "Comedy", uploader: { _id: "ch-comedy-hub", name: "Comedy Hub" } },

  { _id: "education-1", videotitle: "JavaScript Full Course", videochanel: "freeCodeCamp.org", views: 8500000, createdAt: "2025-08-03T09:00:00.000Z", youtubeId: "PkZNo7MFNFg", category: "Education", uploader: { _id: "ch-freecodecamp", name: "freeCodeCamp.org" } },
  { _id: "education-2", videotitle: "Learning Faster", videochanel: "Study Smart", views: 690000, createdAt: "2025-09-30T10:00:00.000Z", youtubeId: "IlU-zDU6aQ0", category: "Education", uploader: { _id: "ch-study-smart", name: "Study Smart" } },

  { _id: "science-1", videotitle: "Black Holes Explained", videochanel: "Kurzgesagt", views: 1120000, createdAt: "2025-07-07T08:00:00.000Z", youtubeId: "e-P5IFTqB98", category: "Science", uploader: { _id: "ch-kurzgesagt", name: "Kurzgesagt" } },
  { _id: "science-2", videotitle: "Space Missions Overview", videochanel: "Astro Lab", views: 810000, createdAt: "2025-12-03T08:00:00.000Z", youtubeId: "M7lc1UVf-VE", category: "Science", uploader: { _id: "ch-astro-lab", name: "Astro Lab" } },

  { _id: "travel-1", videotitle: "Switzerland Travel Guide", videochanel: "Nature Relaxation", views: 3100000, createdAt: "2025-06-20T15:00:00.000Z", youtubeId: "35npVaFGHMY", category: "Travel", uploader: { _id: "ch-nature-relaxation", name: "Nature Relaxation" } },
  { _id: "travel-2", videotitle: "Italy City Walk", videochanel: "Travel Canvas", views: 540000, createdAt: "2025-08-11T15:00:00.000Z", youtubeId: "ScMzIvxBSi4", category: "Travel", uploader: { _id: "ch-travel-canvas", name: "Travel Canvas" } },

  { _id: "food-1", videotitle: "Street Food Journey", videochanel: "Food Trails", views: 1200000, createdAt: "2025-10-03T13:00:00.000Z", youtubeId: "fLexgOxsZu0", category: "Food", uploader: { _id: "ch-food-trails", name: "Food Trails" } },
  { _id: "food-2", videotitle: "Quick Dinner in 20 Minutes", videochanel: "Home Chef", views: 740000, createdAt: "2025-12-10T13:40:00.000Z", youtubeId: "IlU-zDU6aQ0", category: "Food", uploader: { _id: "ch-home-chef", name: "Home Chef" } },

  { _id: "fashion-1", videotitle: "Style Essentials", videochanel: "Style Street", views: 410000, createdAt: "2025-09-01T16:00:00.000Z", youtubeId: "uelHwf8o7_U", category: "Fashion", uploader: { _id: "ch-style-street", name: "Style Street" } },
  { _id: "fashion-2", videotitle: "Minimal Wardrobe Guide", videochanel: "Fit and Form", views: 360000, createdAt: "2025-10-13T16:20:00.000Z", youtubeId: "jNQXAC9IVRw", category: "Fashion", uploader: { _id: "ch-fit-form", name: "Fit and Form" } },
];

const isValidYoutubeId = (id: string) => /^[a-zA-Z0-9_-]{11}$/.test(id);

export const sampleYoutubeVideos = curatedSampleVideos.filter((video) => isValidYoutubeId(video.youtubeId));
