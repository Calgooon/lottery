import {
    assert,
    method,
    prop,
    Sha256,
    hash160,
    SmartContract,
    PubKey,
    Sig,
    hash256,
    Utils,
    ByteString,
    sha256,
    FixedArray,
    int2ByteString,
    bsv,
    ContractTransaction,
    MethodCallOptions,
    UTXO,
    pubKey2Addr,
} from 'scrypt-ts'
import Transaction = bsv.Transaction
import Script = bsv.Script
import Address = bsv.Address

export class Lottery extends SmartContract {
    @prop()
    owner: PubKey // Contract owner

    @prop(true)
    participants: FixedArray<PubKey, 2> // List of participant public keys

    @prop(true)
    nonceHashes: FixedArray<Sha256, 2> // List of nonce hashes

    @prop(true)
    totalAmount: bigint // Track total amount from all participants

    @prop(true)
    isOver: boolean // Track if lottery has been drawn

    constructor(
        owner: PubKey,
        participants: FixedArray<PubKey, 2>,
        nonceHashes: FixedArray<Sha256, 2>
    ) {
        super(...arguments)
        this.owner = owner
        this.participants = participants
        this.nonceHashes = nonceHashes
        this.totalAmount = 0n
        this.isOver = false
    }

    @method()
    public fund(sig: Sig, amount: bigint) {
        assert(!this.isOver, 'Lottery has already been drawn')
        // Only the owner can add a participant
        assert(
            this.checkSig(sig, this.owner),
            'Only the owner can enter participants'
        )

        this.totalAmount = amount

        let output: ByteString =
            this.buildStateOutput(this.totalAmount) + this.buildChangeOutput()
        
        assert(
            this.ctx.hashOutputs === hash256(output),
            'New utxo must have enough to pay winner'
        )
        // assert(true)
    }

    @method()
    public draw(nonce: FixedArray<bigint, 2>, sig: Sig) {
        // Only owner can draw the winner
        assert(this.checkSig(sig, this.owner), 'Only the owner can draw')
        assert(!this.isOver, 'Lottery has already been drawn')
        assert(this.totalAmount > 0n, 'No satoshis in lottery')

        this.isOver = true

        let sum = 0n

        for (let i = 0; i < 2; i++) {
            assert(sha256(int2ByteString(nonce[i])) == this.nonceHashes[i])

            sum += nonce[i]
        }

        const winner: PubKey = this.participants[Number(sum % BigInt(2))]
        console.log(Number(sum % BigInt(2)))

        // Transfer funds to winner
        const outputs =
            Utils.buildPublicKeyHashOutput(
                hash160(winner),
                this.totalAmount
            ) + this.buildChangeOutput()
        assert(this.ctx.hashOutputs == hash256(outputs), 'Output mismatch')
    }

    // User defined transaction builder for calling function `bid`
    static fundTxBuilder(
        current: Lottery,
        options: MethodCallOptions<Lottery>,
        amount: bigint
    ): Promise<ContractTransaction> {
        const nextInstance = current.next()
        // console.log(options.fromUTXO)

        const unsignedTx: Transaction = new Transaction()
            // add contract input
            .addInput(current.buildContractInput())
            // build next instance output
            .addOutput(
                new Transaction.Output({
                    script: nextInstance.lockingScript,
                    satoshis: Number(amount),
                })
            )

        return Promise.resolve({
            tx: unsignedTx,
            atInputIndex: 0,
            nexts: [
                {
                    instance: nextInstance,
                    atOutputIndex: 0,
                    balance: Number(amount),
                },
            ],
        })
    }


    static async drawTxBuilder(
        current: Lottery,
        options: MethodCallOptions<Lottery>,
        nonce: FixedArray<bigint, 2>
    ): Promise<ContractTransaction> {
        let sum = 0n

        for (let i = 0; i < 2; i++) {
            assert(sha256(int2ByteString(nonce[i])) == current.nonceHashes[i])
            sum += nonce[i]
        }
        const winner: PubKey = current.participants[Number(sum % BigInt(2))]

        console.log(current.owner)
        
        const unsignedTx: bsv.Transaction = new bsv.Transaction()
            // add contract input
            .addInput(current.buildContractInput())
            // build winner output first
            .addOutput(
                new bsv.Transaction.Output({
                    script: bsv.Script.fromHex(
                        Utils.buildPublicKeyHashScript(hash160(winner))
                    ),
                    satoshis: Number(current.totalAmount),
                })
            )
            // build change output
            .change('1KxdCGxkzXXaE4VheqjWonALBtB1UE1V22')

        return Promise.resolve({
            tx: unsignedTx,
            atInputIndex: 0,
            nexts: [], // No next instance needed since contract is over
        })
    }
}
