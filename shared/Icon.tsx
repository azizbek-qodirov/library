const paths = {
  library: 'M3 4h5v16H3zM9 4h5v16H9zM15 5l4-1 4 15-4 1zM3 8h5m1 0h5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm4-4a4 4 0 0 1 0 8',
  folder: 'M3 7V5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
  pen: 'm4 15-1 6 6-1L21 8l-5-5L4 15zm9-9 5 5',
  building: 'M3 21h18M5 21V6l7-3 7 3v15M9 9h1m4 0h1m-6 4h1m4 0h1m-5 8v-4h4v4',
  book: 'M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2zm0 0v15',
  loans: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 6h8m-8 6h5',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  logout: 'M10 4H4v16h6m-1-8h12m-4-4 4 4-4 4',
  globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z',
  warning: 'M12 3 2 21h20L12 3zm0 6v5m0 3v.1',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
