import { Client, Account, Databases, ID, Permission, Role, Query } from "appwrite";

// Read env vars once
const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;

// Lazily initialize Appwrite client only when env vars are present.
// This prevents runtime errors on GitHub Pages where these envs are not configured.
let client = null;
let account = null;
let databases = null;

if (APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID) {
  client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
  account = new Account(client);
  databases = new Databases(client);
} else {
  console.warn(
    "Appwrite env vars are missing; Appwrite client will not be initialized. " +
      "Search tracking and trending features depending on Appwrite are disabled."
  );
}

export function validateAppwriteEnv() {
  const endpoint = APPWRITE_ENDPOINT;
  const projectId = APPWRITE_PROJECT_ID;
  const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
  const collectionId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

  const missing = [];
  if (!endpoint) missing.push("VITE_APPWRITE_ENDPOINT");
  if (!projectId) missing.push("VITE_APPWRITE_PROJECT_ID");
  if (!databaseId) missing.push("VITE_APPWRITE_DATABASE_ID");
  if (!collectionId) missing.push("VITE_APPWRITE_COLLECTION_ID");

  if (missing.length) {
    console.warn(`Missing Appwrite env vars: ${missing.join(", ")}`);
    return false;
  }
  return true;
}

export async function ensureAnonymousSession() {
  if (!account) return; // Appwrite not initialized

  try {
    await account.get();
    return; // already authenticated
  } catch {
    // not authenticated; create anonymous session
  }
  try {
    await account.createAnonymousSession();
  } catch (err) {
    console.warn("Failed to create anonymous session:", err);
  }
}

// Creates a document recording the search term and basic movie info
// Requires env vars: VITE_APPWRITE_DATABASE_ID, VITE_APPWRITE_COLLECTION_ID
export async function updateSearchCount(searchTerm, topMovie) {
  if (!databases) return; // Appwrite not initialized

  const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
  const collectionId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

  if (!databaseId || !collectionId) {
    console.warn("Appwrite DB/Collection env vars missing; skipping updateSearchCount");
    return;
  }

  try {
    const payload = {
      searchTerm,
      movieId: topMovie?.id ?? null,
      title: topMovie?.title ?? null,
      posterPath: topMovie?.poster_path ?? null,
      voteAverage: typeof topMovie?.vote_average === 'number' ? topMovie.vote_average : null,
      createdAt: new Date().toISOString(),
    };

    await databases.createDocument(
      databaseId,
      collectionId,
      ID.unique(),
      payload,
      [
        Permission.read(Role.any()),
        Permission.update(Role.user("*")),
        Permission.delete(Role.user("*")),
        Permission.create(Role.user("*")),
      ]
    );
  } catch (err) {
    console.warn("Failed to update search count in Appwrite:", err);
  }
}

export async function getTrendingMovies(limit = 10) {
  if (!databases) return [];

  const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
  const collectionId = import.meta.env.VITE_APPWRITE_COLLECTION_ID;

  if (!databaseId || !collectionId) {
    console.warn("Appwrite DB/Collection env vars missing; getTrendingMovies returns empty list");
    return [];
  }

  try {
    const { documents } = await databases.listDocuments(
      databaseId,
      collectionId,
      [
        Query.orderDesc("createdAt"),
        Query.limit(200),
      ]
    );

    const movieIdToStats = new Map();

    for (const doc of documents) {
      const movieId = doc.movieId ?? null;
      if (movieId === null) continue;

      if (!movieIdToStats.has(movieId)) {
        movieIdToStats.set(movieId, {
          movieId,
          title: doc.title ?? null,
          posterPath: doc.posterPath ?? null,
          voteAverage: typeof doc.voteAverage === 'number' ? doc.voteAverage : null,
          count: 0,
        });
      }
      const stats = movieIdToStats.get(movieId);
      stats.count += 1;
    }

    const sorted = Array.from(movieIdToStats.values()).sort((a, b) => b.count - a.count);
    return sorted.slice(0, Math.max(0, limit));
  } catch (err) {
    console.warn("Failed to list trending movies from Appwrite:", err);
    return [];
  }
}

export { client, account, databases };
