import { Client, Databases, Storage } from "appwrite";

// Appwrite configuration
const client = new Client();

client
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || "")
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "");

export const databases = new Databases(client);
export const storage = new Storage(client);

export const config = {
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || "",
  speechesCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID || "",
  channelsCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID || "",
  historyCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_HISTORY_COLLECTION_ID || "",
};

export default client;
