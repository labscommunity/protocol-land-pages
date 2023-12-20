const ArDB = require('ardb');
const path = require('path');
const Arweave = require('arweave');
const fsPromises = require('fs').promises;
const mime = require('mime');
const {uploadFile} = require('./arweaveHelper.js');
const crypto = require('crypto');
const {log, withAsync} = require('./common.js');

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

const hasIndexFile = (filePaths) =>
  filePaths.some((filePath) => filePath === 'index.html');

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
    size: 0,
    getContent: () => getFileContent(path.join(basePath, filePath)),
  }));
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function getUploadSize(files) {
  return files.flat(Infinity).reduce((i, file) => i + file.size, 0);
}

async function getArweaveUSD() {
  const {response: firstResponse} = await withAsync(() =>
    fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd`
    )
  );
  if (firstResponse) {
    const data = await firstResponse.json();
    return data.arweave.usd;
  }

  const {response} = await withAsync(() =>
    fetch(
      'https://api.redstone.finance/prices/?symbol=AR&provider=redstone&limit=1'
    )
  );
  if (response) {
    const data = await response.json();
    return data[0].value;
  }

  return 0;
}

async function getWinstonPriceForBytes(bytes) {
  try {
    const response = await fetch(`https://arweave.net/price/${bytes}`);
    const winston = await response.text();

    return +winston;
  } catch (error) {
    return 0;
  }
}

async function calculateEstimate(uploadSizeInBytes) {
  const formattedSizeInfo = formatBytes(uploadSizeInBytes);

  const costInWinston = await getWinstonPriceForBytes(uploadSizeInBytes);
  const costInAR = parseFloat(arweave.ar.winstonToAr(costInWinston));

  const costFor1ARInUSD = await getArweaveUSD();
  const costInUSD = costInAR * costFor1ARInUSD;

  return {
    formattedSizeInfo,
    costInAR: costInAR.toPrecision(5),
    costInUSD: costInUSD.toPrecision(5),
  };
}

async function uploadFiles(basePath, filePaths, commit, repo) {
  log('Deploying...', {color: 'green'});
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
      const {size} = await fsPromises.stat(path.join(basePath, file.path));
      file.hash = hash;
      file.size = size;
      return file;
    })
  );

  const isNextApp = hasNextAppFiles(files);
  const hashToTxId = await getHashToTxId(files);
  const uploadSizeInBytes = await getUploadSize(files);
  const estimate = await calculateEstimate(uploadSizeInBytes);

  log(
    `Cost Estimates:\n
    Size: ${estimate.formattedSizeInfo}\n
    Cost: ~${estimate.costInAR} AR (~${estimate.costInUSD} USD)\n
    This is an approximate cost for this deployment.\n`,
    {color: 'green'}
  );

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

exports.uploadFiles = uploadFiles;
exports.hasIndexFile = hasIndexFile;
