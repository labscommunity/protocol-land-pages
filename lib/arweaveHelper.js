const Arweave = require('arweave');
const {ArweaveSigner, bundleAndSignData, createData} = require('arbundles');
const common = require('./common.js');

async function getAddress(wallet) {
  return await initArweave().wallets.jwkToAddress(
    wallet ? wallet : common.getWallet()
  );
}

function initArweave() {
  return Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
  });
}

async function uploadFile(file, tags) {
  try {
    const uploadedTx = await subsidizedUpload(file, tags);
    return uploadedTx.data.repoTxId;
  } catch (e) {
    try {
      const turboTxId = await turboUpload(file, tags);
      return turboTxId;
    } catch (error) {
      const arweaveTxId = await arweaveUpload(file, tags);
      return arweaveTxId;
    }
  }
}

async function arweaveUpload(file, tags) {
  const jwk = common.getWallet();
  if (!jwk) {
    throw '[ arweave ] No jwk wallet supplied';
  }
  const arweave = initArweave();

  const dataSize = file.length;
  const tx = await arweave.createTransaction({data: file}, jwk);
  for (const tag of tags) {
    tx.addTag(tag.name, tag.value);
  }

  await arweave.transactions.sign(tx, jwk);

  const uploader = await arweave.transactions.getUploader(tx);
  while (!uploader.isComplete) {
    await uploader.uploadChunk();
  }

  if (uploader.lastResponseStatus !== 200) {
    // throw error if arweave tx wasn't posted
    throw `[ arweave ] Uploading file to arweave failed.\n\tError: '${
      uploader.lastResponseStatus
    }' - '${
      uploader.lastResponseError
    }'\n\tCheck if you have plenty $AR to upload ~${Math.ceil(
      dataSize / 1024
    )} KB of data.`;
  }

  return tx.id;
}

async function turboUpload(file, tags) {
  const jwk = common.getWallet();
  if (!jwk) {
    throw '[ turbo ] No jwk wallet supplied';
  }

  const node = 'https://turbo.ardrive.io';
  const uint8ArrayFile = new Uint8Array(file);
  const signer = new ArweaveSigner(jwk);

  const dataItem = createData(uint8ArrayFile, signer, {tags});

  await dataItem.sign(signer);

  const res = await fetch(`${node}/tx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: dataItem.getRaw(),
  });

  if (res.status >= 400) {
    throw new Error(
      `[ turbo ] Uploading file with turbo failed. Error: ${res.status} - ${res.statusText}`
    );
  }

  return dataItem.id;
}

async function subsidizedUpload(zipBuffer, tags) {
  const jwk = common.getWallet();
  if (!jwk) {
    throw 'No jwk wallet supplied';
  }

  const node = 'https://subsidize.saikranthi.dev/api/v1/postrepo';
  const uint8ArrayZip = new Uint8Array(zipBuffer);
  const signer = new ArweaveSigner(jwk);
  const address = await getAddress();

  const dataItem = createData(uint8ArrayZip, signer, {tags});
  await dataItem.sign(signer);

  const bundle = await bundleAndSignData([dataItem], signer);

  const res = await fetch(`${node}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      txBundle: bundle.getRaw(),
      platform: 'CLI',
      owner: address,
    }),
  });
  const upload = await res.json();

  if (!upload || !upload.success) {
    throw new Error(
      `[ PL SUBSIDIZE ] Uploading failed. Error: ${res.status} - ${res.statusText}`
    );
  }

  return upload;
}

exports.getAddress = getAddress;
exports.uploadFile = uploadFile;
