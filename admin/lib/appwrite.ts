/**
 * Appwrite database utilities
 */

import { Client, Databases, ID, Query } from "node-appwrite";

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const CHANNELS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;

export function getAppwriteClient() {
  const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return new Databases(client);
}

export async function channelExists(databases: Databases, youtubeChannelId: string) {
  try {
    const response = await databases.listDocuments(DATABASE_ID, CHANNELS_COLLECTION_ID, [
      Query.equal("youtubeChannelId", youtubeChannelId),
      Query.limit(1),
    ]);

    return response.documents.length > 0;
  } catch (error) {
    throw new Error(`Failed to check channel existence: ${error}`);
  }
}

export async function addChannel(
  databases: Databases,
  channelData: {
    type: string;
    name: string;
    youtubeChannelId: string;
    thumbnailUrl: string;
    description: string;
    ignoreDuration: boolean;
    includeShorts: boolean;
  }
) {
  try {
    const document = await databases.createDocument(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      ID.unique(),
      channelData
    );

    return document;
  } catch (error) {
    throw new Error(`Failed to add channel: ${error}`);
  }
}

export async function deleteChannel(databases: Databases, documentId: string) {
  try {
    await databases.deleteDocument(DATABASE_ID, CHANNELS_COLLECTION_ID, documentId);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete channel: ${error}`);
  }
}

export async function updateChannel(
  databases: Databases,
  documentId: string,
  updates: Partial<{
    ignoreDuration: boolean;
    includeShorts: boolean;
    name: string;
    description: string;
  }>
) {
  try {
    const document = await databases.updateDocument(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      documentId,
      updates
    );
    return document;
  } catch (error) {
    throw new Error(`Failed to update channel: ${error}`);
  }
}

export async function getAllChannels(databases: Databases) {
  const allChannels = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(DATABASE_ID, CHANNELS_COLLECTION_ID, [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allChannels.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allChannels;
}
