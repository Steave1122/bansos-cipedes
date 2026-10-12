'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ReadPengajuanWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.idsTerdaftar = ['20','21','22','23','24','25','26','27','28','29','30','31','32','33'];
    }

    async submitTransaction() {
        const idAcak = this.idsTerdaftar[Math.floor(Math.random() * this.idsTerdaftar.length)];
        const args = {
            contractId: 'bansos',
            contractFunction: 'QueryPengajuan',
            contractArguments: [idAcak],
            invokerIdentity: 'admin',
            readOnly: true
        };
        await this.sutAdapter.sendRequests(args);
    }
}

function createWorkloadModule() {
    return new ReadPengajuanWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
