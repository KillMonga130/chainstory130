import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      // Halloween-themed splash screen
      appDisplayName: 'Pumpkin Collector',
      backgroundUri: 'default-splash.png',
      buttonLabel: '🎃 Start Collecting!',
      description: 'Help the friendly ghost collect pumpkins while avoiding spooky monsters! Use WASD or arrow keys to move.',
      entryUri: 'index.html',
      heading: '👻 Halloween Pumpkin Collector 🎃',
      appIconUri: 'default-icon.png',
    },
    postData: {
      gameType: 'halloween-pumpkin-collector',
      theme: 'spooky',
      highScore: 0,
    },
    subredditName: subredditName,
    title: '🎃 Halloween Pumpkin Collector - Spooky Fun Game! 👻',
  });
};
