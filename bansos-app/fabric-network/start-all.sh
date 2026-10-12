#!/bin/bash

echo ">>> Starting Fabric network..."
cd ~/bansos-project/bansos-app/fabric-network
./network.sh up

echo ">>> Waiting for containers..."
sleep 8

echo ">>> Deploying chaincode..."
./deploy-chaincode.sh

echo ">>> Restarting peers to ensure channel join..."
docker restart fabric-network-peer0.kelurahan.cipedes.com-1
docker restart fabric-network-peer0.puskesos.cipedes.com-1
sleep 10

echo ">>> All services ready!"#!/bin/bash

echo ">>> Starting Fabric network..."
cd ~/bansos-project/bansos-app/fabric-network
./network.sh up

echo ">>> Waiting for containers..."
sleep 8

echo ">>> Deploying chaincode..."
./deploy-chaincode.sh

echo ">>> All services ready!"
