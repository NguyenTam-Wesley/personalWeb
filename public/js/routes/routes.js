// public/js/routes.js

export const ROUTES = {
    home: '/',
    
    pages: {
      music: '/pages/music.html',
      study: '/pages/study.html',
      games: '/pages/games.html',
      blog: '/pages/blog.html',
      novel: '/pages/novel.html',
      login: '/pages/login.html',
      profile: '/pages/profile.html',
    },
  
    admin: {
      dashboard: '/pages/admin/admin.html'
    },
  
    novel: {
      detail: '/pages/novel/novel-detail.html'
    }
  };
  
  // Helper: chuyển route key → url
  export function route(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], ROUTES);
  }
  