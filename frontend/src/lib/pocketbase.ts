import PocketBase from 'pocketbase';

const getPocketbaseUrl = () => {
  // Use env variable if set, otherwise use the current host/port as fallback
  if (import.meta.env.VITE_POCKETBASE_URL) {
    return import.meta.env.VITE_POCKETBASE_URL;
  }
  // Use current hostname and port 8090 as fallback
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8090`;
};

const pb = new PocketBase(getPocketbaseUrl());

// Enable auto-cancellation for requests
pb.autoCancellation(false);

export default pb;
