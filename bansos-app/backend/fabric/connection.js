const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ccpPath = path.resolve(__dirname, 'connection-profile.json');

async function getContract() {
  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
  const wallet = await Wallets.newInMemoryWallet();

  const certPath = process.env.FABRIC_CERT_PATH;
  const keyPath = process.env.FABRIC_KEY_PATH;
  const keyFiles = fs.readdirSync(keyPath);
  const keyFile = path.join(keyPath, keyFiles[0]);

  const identity = {
    credentials: {
      certificate: fs.readFileSync(certPath).toString(),
      privateKey: fs.readFileSync(keyFile).toString(),
    },
    mspId: process.env.FABRIC_MSP_ID,
    type: 'X.509',
  };

  await wallet.put('admin', identity);

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: 'admin',
    discovery: { enabled: false, asLocalhost: false }
  });

  const network = await gateway.getNetwork(process.env.FABRIC_CHANNEL_NAME);
  const contract = network.getContract(process.env.FABRIC_CHAINCODE_NAME);

  return { gateway, contract, client: null };
}

module.exports = { getContract };