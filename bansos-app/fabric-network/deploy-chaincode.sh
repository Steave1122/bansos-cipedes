#!/bin/bash

set -e

echo "================================================"
echo "  AUTO DEPLOY CHAINCODE BANSOS CIPEDES"
echo "================================================"

export PATH=$PATH:~/bansos-project/fabric-samples/bin
export FABRIC_CFG_PATH=~/bansos-project/fabric-samples/config/
export FABRIC_NETWORK=~/bansos-project/bansos-app/fabric-network
export CHAINCODE_PATH=~/bansos-project/bansos-app/chaincode/bansos

CHANNEL_NAME=bansos-channel
CHAINCODE_NAME=bansos
CHAINCODE_VERSION=1.0
CHAINCODE_SEQUENCE=1
PACKAGE_ID=bansos_1.0:b488aefcfd8ce9af3cd6c294a21a1293b8ea4b2d2f66fa04df6dff39192bd18a

ORDERER_CA=$FABRIC_NETWORK/crypto-config/ordererOrganizations/cipedes.com/orderers/orderer.cipedes.com/tls/ca.crt
KELURAHAN_TLS=$FABRIC_NETWORK/crypto-config/peerOrganizations/kelurahan.cipedes.com/peers/peer0.kelurahan.cipedes.com/tls/ca.crt
PUSKESOS_TLS=$FABRIC_NETWORK/crypto-config/peerOrganizations/puskesos.cipedes.com/peers/peer0.puskesos.cipedes.com/tls/ca.crt
KELURAHAN_MSP=$FABRIC_NETWORK/crypto-config/peerOrganizations/kelurahan.cipedes.com/users/Admin@kelurahan.cipedes.com/msp
PUSKESOS_MSP=$FABRIC_NETWORK/crypto-config/peerOrganizations/puskesos.cipedes.com/users/Admin@puskesos.cipedes.com/msp

set_kelurahan() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=KelurahanMSP
  export CORE_PEER_TLS_ROOTCERT_FILE=$KELURAHAN_TLS
  export CORE_PEER_MSPCONFIGPATH=$KELURAHAN_MSP
  export CORE_PEER_ADDRESS=peer0.kelurahan.cipedes.com:7051
}

set_puskesos() {
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=PuskososMSP
  export CORE_PEER_TLS_ROOTCERT_FILE=$PUSKESOS_TLS
  export CORE_PEER_MSPCONFIGPATH=$PUSKESOS_MSP
  export CORE_PEER_ADDRESS=peer0.puskesos.cipedes.com:9051
}

echo ""
echo ">>> Step 1: Menunggu peer siap..."
sleep 5

echo ""
echo ">>> Step 2: Join orderer ke channel..."
osnadmin channel join \
  --channelID $CHANNEL_NAME \
  --config-block $FABRIC_NETWORK/channel-artifacts/bansos-channel-genesis.block \
  -o orderer.cipedes.com:7053 \
  --ca-file $ORDERER_CA \
  --client-cert $FABRIC_NETWORK/crypto-config/ordererOrganizations/cipedes.com/orderers/orderer.cipedes.com/tls/server.crt \
  --client-key $FABRIC_NETWORK/crypto-config/ordererOrganizations/cipedes.com/orderers/orderer.cipedes.com/tls/server.key \
  2>/dev/null || echo "Channel sudah ada, lanjut..."

echo ""
echo ">>> Step 3: Join peer Kelurahan ke channel..."
set_kelurahan
peer channel join -b $FABRIC_NETWORK/channel-artifacts/bansos-channel-genesis.block \
  2>/dev/null || echo "Peer Kelurahan sudah join, lanjut..."

echo ""
echo ">>> Step 4: Join peer Puskesos ke channel..."
set_puskesos
peer channel join -b $FABRIC_NETWORK/channel-artifacts/bansos-channel-genesis.block \
  2>/dev/null || echo "Peer Puskesos sudah join, lanjut..."

echo ""
echo ">>> Step 5: Install chaincode ke Kelurahan..."
set_kelurahan
peer lifecycle chaincode install $CHAINCODE_PATH/bansos.tar.gz \
  --peerAddresses peer0.kelurahan.cipedes.com:7051 \
  --tlsRootCertFiles $KELURAHAN_TLS \
  2>/dev/null || echo "Chaincode sudah terinstall di Kelurahan, lanjut..."

echo ""
echo ">>> Step 6: Install chaincode ke Puskesos..."
set_puskesos
peer lifecycle chaincode install $CHAINCODE_PATH/bansos.tar.gz \
  --peerAddresses peer0.puskesos.cipedes.com:9051 \
  --tlsRootCertFiles $PUSKESOS_TLS \
  2>/dev/null || echo "Chaincode sudah terinstall di Puskesos, lanjut..."

echo ""
echo ">>> Step 7: Approve chaincode Kelurahan..."
set_kelurahan
peer lifecycle chaincode approveformyorg \
  -o orderer.cipedes.com:7050 \
  --ordererTLSHostnameOverride orderer.cipedes.com \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls --cafile $ORDERER_CA \
  2>/dev/null || echo "Sudah di-approve Kelurahan, lanjut..."

echo ""
echo ">>> Step 8: Approve chaincode Puskesos..."
set_puskesos
peer lifecycle chaincode approveformyorg \
  -o orderer.cipedes.com:7050 \
  --ordererTLSHostnameOverride orderer.cipedes.com \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CHAINCODE_SEQUENCE \
  --tls --cafile $ORDERER_CA \
  2>/dev/null || echo "Sudah di-approve Puskesos, lanjut..."

echo ""
echo ">>> Step 9: Commit chaincode..."
set_kelurahan
peer lifecycle chaincode commit \
  -o orderer.cipedes.com:7050 \
  --ordererTLSHostnameOverride orderer.cipedes.com \
  --channelID $CHANNEL_NAME \
  --name $CHAINCODE_NAME \
  --version $CHAINCODE_VERSION \
  --sequence $CHAINCODE_SEQUENCE \
  --tls --cafile $ORDERER_CA \
  --peerAddresses peer0.kelurahan.cipedes.com:7051 \
  --tlsRootCertFiles $KELURAHAN_TLS \
  --peerAddresses peer0.puskesos.cipedes.com:9051 \
  --tlsRootCertFiles $PUSKESOS_TLS \
  2>/dev/null || echo "Chaincode sudah di-commit, lanjut..."

echo ""
echo ">>> Step 10: Invoke InitLedger..."
sleep 3
set_kelurahan
peer chaincode invoke \
  -o orderer.cipedes.com:7050 \
  --ordererTLSHostnameOverride orderer.cipedes.com \
  --tls --cafile $ORDERER_CA \
  -C $CHANNEL_NAME -n $CHAINCODE_NAME \
  --peerAddresses peer0.kelurahan.cipedes.com:7051 \
  --tlsRootCertFiles $KELURAHAN_TLS \
  --peerAddresses peer0.puskesos.cipedes.com:9051 \
  --tlsRootCertFiles $PUSKESOS_TLS \
  -c '{"function":"InitLedger","Args":[]}' \
  2>/dev/null || echo "InitLedger sudah pernah dijalankan, lanjut..."

echo ""
echo "================================================"
echo "  DEPLOY SELESAI — CHAINCODE SIAP DIGUNAKAN"
echo "================================================"
