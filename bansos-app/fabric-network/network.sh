#!/bin/bash

FABRIC_BIN=~/bansos-project/fabric-samples/bin
export PATH=$PATH:$FABRIC_BIN

function generateCrypto() {
  echo "===> Generating crypto material..."
  cryptogen generate --config=./crypto-config.yaml --output=./crypto-config
  if [ $? -ne 0 ]; then
    echo "Failed to generate crypto material"
    exit 1
  fi
  echo "===> Crypto material generated successfully"
}

function generateGenesis() {
  echo "===> Generating genesis block..."
  mkdir -p channel-artifacts
  configtxgen -profile BansosOrdererGenesis \
    -channelID system-channel \
    -outputBlock ./channel-artifacts/genesis.block \
    -configPath .
  if [ $? -ne 0 ]; then
    echo "Failed to generate genesis block"
    exit 1
  fi
  echo "===> Genesis block generated successfully"
}

function generateChannelTx() {
  echo "===> Generating channel transaction..."
  configtxgen -profile BansosChannel \
    -outputCreateChannelTx ./channel-artifacts/bansos-channel.tx \
    -channelID bansos-channel \
    -configPath .
  if [ $? -ne 0 ]; then
    echo "Failed to generate channel transaction"
    exit 1
  fi
  echo "===> Channel transaction generated successfully"
}

function networkUp() {
  echo "===> Starting network..."
  docker compose up -d
  echo "===> Network started"
  docker ps
}

function networkDown() {
  echo "===> Stopping network..."
  docker compose down --volumes --remove-orphans
  echo "===> Network stopped"
}

function networkStatus() {
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

case "$1" in
  generate)
    generateCrypto
    generateGenesis
    generateChannelTx
    ;;
  up)
    networkUp
    ;;
  down)
    networkDown
    ;;
  status)
    networkStatus
    ;;
  all)
    generateCrypto
    generateGenesis
    generateChannelTx
    networkUp
    ;;
  *)
    echo "Usage: ./network.sh [generate|up|down|status|all]"
    exit 1
esac
