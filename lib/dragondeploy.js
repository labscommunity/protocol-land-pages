import ArDB from 'ardb';
import Arweave from 'arweave';
import crypto from 'crypto';
import mime from 'mime';
import path from 'path';
import {promises as fsPromises} from 'fs';
import {uploadFile} from './arweaveHelper.js';

const APP_NAME = 'Dragon-Deploy';
const APP_VERSION = '0.3.0';
const MANIFEST_CONTENT_TYPE = 'application/x.arweave-manifest+json';

const arweave = new Arweave({
  host: 'ar-io.net',
  port: 443,
  protocol: 'https',
});

const ardb = new (ArDB.default || ArDB)(arweave);

function getValueFromTags(tags, name) {
  const tag = tags.find((tag) => tag.name === name);
  return tag?.value ?? '';
}

// function uint8ArrayToString(data) {
//   return new TextDecoder('utf-8').decode(data);
// }

function stringToUint8Array(data) {
  return new TextEncoder().encode(data);
}

async function toHash(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

const hasNextAppFiles = (files) =>
  files.some((file) => /_next[\\/]/.test(file.path));

// const hasIndexFile = (files) =>
//   files.some((file) => file.path === 'index.html');

// async function updateFileContent(file) {
//   if (!file.path.endsWith('.html')) {
//     return file;
//   }
//   try {
//     let content = uint8ArrayToString(await file.getContent());
//     if (
//       /src=["'](?!\/\/)(\/.*?\.[^\/"']*?)["']/g.test(content) ||
//       /href=["'](?!\/\/)(\/.*?\.[^\/"']*?)["']/g.test(content)
//     ) {
//       content = content
//         .replace(/src=["'](?!\/\/)(\/.*?\.[^\/"']*?)["']/g, 'src=".$1"')
//         .replace(/href=["'](?!\/\/)(\/.*?\.[^\/"']*?)["']/g, 'href=".$1"');

//       file.getContent = () => Promise.resolve(stringToUint8Array(content));
//       return file;
//     }
//   } catch (err) {
//     //
//   }
//   return file;
// }

async function getHashToTxId(files) {
  const hashToTxId = {};
  try {
    const hashes = files.map((file) => file.hash);
    const txs = await ardb
      .appName(APP_NAME)
      .search('transactions')
      .only(['id', 'tags'])
      .tags([{name: 'File-Hash', values: hashes}])
      .findAll();
    txs.forEach((tx) => {
      const hash = getValueFromTags(tx._tags, 'File-Hash');
      hashToTxId[hash] = tx.id;
    });
  } catch (error) {
    //
  }
  return hashToTxId;
}

async function getFileContent(filePath) {
  return await fsPromises.readFile(filePath);
}

function processFiles(basePath, filePaths) {
  return filePaths.map((filePath) => ({
    path: filePath,
    hash: '',
    getContent: () => getFileContent(path.join(basePath, filePath)),
  }));
}

export async function uploadFiles(basePath, filePaths, commit, repo) {
  let files = processFiles(basePath, filePaths);
  const manifest = {
    manifest: 'arweave/paths',
    version: '0.1.0',
    index: {
      path: 'index.html',
    },
    paths: {},
  };

  files = await Promise.all(
    files.map(async (file) => {
      // file = await updateFileContent(file) // TODO: Finalize whether to use this
      const hash = await toHash(await file.getContent());
      file.hash = hash;
      return file;
    })
  );

  const isNextApp = hasNextAppFiles(files);
  const hashToTxId = await getHashToTxId(files);

  await Promise.all(
    files.map(async (file) => {
      const filePath = file.path;
      const updatedFilePath =
        isNextApp && filePath.endsWith('.html') && filePath !== 'index.html'
          ? filePath.replace('.html', '')
          : filePath;
      const hash = file.hash;
      const txId = hashToTxId[hash];
      if (txId) {
        manifest.paths[updatedFilePath] = {id: txId};
      } else {
        const mimeType = mime.getType(filePath) || 'application/octet-stream';

        const tags = [
          {name: 'Content-Type', value: mimeType},
          {name: 'App-Name', value: APP_NAME},
          {name: 'App-Version', value: APP_VERSION},
          {name: 'File-Hash', value: hash},
        ];
        const data = await file.getContent();
        const txId = await uploadFile(data, tags);
        manifest.paths[updatedFilePath] = {id: txId};
      }
    })
  );

  const unixTimestamp = Math.floor(Date.now() / 1000);
  const manifestTags = [
    // Tags for Dragon Deploy
    {name: 'Content-Type', value: MANIFEST_CONTENT_TYPE},
    {name: 'Title', value: repo.name},
    {name: 'App-Name', value: APP_NAME},
    {name: 'App-Version', value: APP_VERSION},
    {name: 'Unix-Time', value: String(unixTimestamp)},
    {name: 'Description', value: repo.description},
    {name: 'Type', value: 'web-page'},
    // Tags for PL
    {name: 'Deployed-Through', value: 'Protocol.Land'},
    {name: 'Repo-Id', value: repo.id},
    {name: 'Repo-Branch', value: repo.deploymentBranch},
    {name: 'Commit-Oid', value: commit.oid},
    {name: 'Commit-Message', value: commit.message},
  ];

  const txId = await uploadFile(
    stringToUint8Array(JSON.stringify(manifest)),
    manifestTags
  );
  return txId;
}
