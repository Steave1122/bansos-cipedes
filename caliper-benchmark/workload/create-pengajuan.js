'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const fs = require('fs');

class CreatePengajuanWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async submitTransaction() {
        this.txIndex++;
        const idUnik = 'PERF_' + this.workerIndex + '_' + this.txIndex + '_' + Date.now();
        const args = {
            contractId: 'bansos',
            contractFunction: 'CatatPengajuan',
            contractArguments: [
                idUnik,
                '999',
                'Benchmark User',
                '9999999999999999',
                'PKH',
                '2026-08-02',
                'Data pengujian performa',
                'benchmarkhash0000000000000000000000000000000000000000000000000'
            ],
            invokerIdentity: 'admin',
            readOnly: false
        };
        let hasil;
        try {
            hasil = await this.sutAdapter.sendRequests(args);
        } catch (err) {
            fs.appendFileSync('/tmp/caliper-detail-error.log', new Date().toISOString() + ' EXCEPTION: ' + (err.stack || err.message || JSON.stringify(err)) + '\n\n');
            throw err;
        }
        fs.appendFileSync('/tmp/caliper-detail-error.log', new Date().toISOString() + ' HASIL: ' + JSON.stringify(hasil, null, 2) + '\n\n');
    }
}

function createWorkloadModule() {
    return new CreatePengajuanWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
