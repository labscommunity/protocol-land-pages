const Arweave = require('arweave');
const {ArweaveSigner, createData} = require('arbundles');
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
    const bundlrTxId = await bundlrUpload(file, tags);
    return bundlrTxId;
  } catch (error) {
    const arweaveTxId = await arweaveUpload(file, tags);
    return arweaveTxId;
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
  const response = await arweave.transactions.post(tx);

  if (response.status !== 200) {
    // throw error if arweave tx wasn't posted
    throw `[ arweave ] Posting file to arweave failed.\n\tError: '${
      response.status
    }' - '${
      response.statusText
    }'\n\tCheck if you have plenty $AR to upload ~${Math.ceil(
      dataSize / 1024
    )} KB of data.`;
  }

  return tx.id;
}

async function bundlrUpload(file, tags) {
  const jwk = common.getWallet();
  if (!jwk) {
    throw '[ bundlr ] No jwk wallet supplied';
  }

  const node = 'https://node2.bundlr.network';
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
      `[ bundlr ] Posting file with bundlr failed. Error: ${res.status} - ${res.statusText}`
    );
  }

  return dataItem.id;
}

exports.getAddress = getAddress;
exports.uploadFile = uploadFile;
