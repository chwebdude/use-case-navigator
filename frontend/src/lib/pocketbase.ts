import PocketBase from 'pocketbase';

const getPocketbaseUrl = () => {
  // Use env variable if set, otherwise use the current host/port as fallback
  if (import.meta.env.VITE_POCKETBASE_URL) {
    return import.meta.env.VITE_POCKETBASE_URL;
  }
  // Use current hostname as fallback
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}`;
};

const pb = new PocketBase(getPocketbaseUrl());

// Enable auto-cancellation for requests
pb.autoCancellation(false);

export default pb;
