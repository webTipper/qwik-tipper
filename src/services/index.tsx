
import {
    Contract,
    ChronikNetworkProvider,
    SignatureTemplate,
  } from "@samrock5000/cashscript";
  import { randomBytes } from "crypto";
  import { ChronikClient } from "chronik-client";
  import { Keys, ContractArg } from '../interfaces'
  import {
    binToHex,
    hexToBin,
    generatePrivateKey,
    instantiateSecp256k1,
    instantiateRipemd160,
    instantiateSha256,
    Base58AddressFormatVersion,
    encodeCashAddress,
    CashAddressType,
    cashAddressToLockingBytecode,
    lockingBytecodeToAddressContents
  } from "@bitauth/libauth";
  
  export const log = console.log;
  
  
  
  export const addrToScriptHash = async (address: string) => {
    const addr: any = cashAddressToLockingBytecode(address);
    const addressBytecode: any = addr.bytecode;
    const addrContent = lockingBytecodeToAddressContents(addressBytecode);
    return binToHex(addrContent.payload)
  }
  
  export const hash160ToCash = (hex: string, network: number = 0x00) => {
    let type: string = Base58AddressFormatVersion[network] || "p2pkh";
    let prefix = "ecash";
    if (type.endsWith("Testnet")) prefix = "ectest";
    let cashType: CashAddressType = 0;
    return encodeCashAddress(prefix, cashType, hexToBin(hex));
  };
  
  
  export const createWallet = async (): Promise<ContractArg> => {
  
  
    const secp256k1 = await instantiateSecp256k1();
    const ripemd160 = await instantiateRipemd160();
    const sha256 = await instantiateSha256();
  
    const secureRandom = generatePrivateKey(() => randomBytes(32));
    const privateKey = sha256.hash(secureRandom)
  
    const privKeyHex: string = binToHex(privateKey);
    const pubKey: Uint8Array = secp256k1.derivePublicKeyCompressed(
      privateKey
    );
  
    const pubKeyHash: Uint8Array = ripemd160.hash(sha256.hash(pubKey));
    const pubKeyHashHex: string = binToHex(pubKeyHash);
  
    const res: ContractArg = {
      pubkey: pubKey,
      pubkeyhashHex: pubKeyHashHex,
      privkey: privateKey,
      privkeyHex: privKeyHex,
    };
  
    return res;
  };
  export const checkBalance = async (addr: string,) => {
  
    if (addr === undefined) {
      log("address is undefined", addr)
      return 0
    }
  
    const chronik = new ChronikClient("https://chronik.be.cash/xec")
    const chronikNet = new ChronikNetworkProvider("mainnet", chronik)
    let txValue: number | BigInt;
    let res;
  
    const address = addr
    log("checkBalance addr", address)
    const utxos = chronikNet.getUtxos(address)
    res = await utxos
    if (res[0].txid == null) {
      log("no utxos available", res[0])
      return res[0].satoshis
    }
    const satoshis = await utxos.then((sats => sats.reduce((acc, utxo) => acc + utxo.satoshis, 0)))
    log("checkBalance Sats ", satoshis)
    txValue = satoshis
    res = txValue === undefined ? 0 : txValue
  
    return res
  
  
  }
  
  export const createTransactionHex = async (
    contract: Promise<Contract>,
    txInfo: Keys,
    amount?: number | BigInt
  ) => {
  
    const secp256k1 = await instantiateSecp256k1();
    // const ripemd160 = await instantiateRipemd160();
    const privKey = hexToBin(txInfo.signerPrivateKey);
  
    log("valid privateKey: ", secp256k1.validatePrivateKey(privKey));
    const pubKey = hexToBin(txInfo.signerPublicKey)
    const receipient = hash160ToCash(txInfo.signerPublicKeyHash);
    const serviceProviderAddr = "ecash:qr4jd3qejeym00u6u4lrzk3p6p3fmc545yjgvknzxr"
    // const addr = (await contract).address
    const serviceFee = 2000
    const amt = amount - serviceFee
  
    log("txinfo", txInfo)
    // log("Contract Addr", contract.address)
    // log("receipient", receipient)
  
    try {
      const tx = await contract.functions
        .spend(pubKey, new SignatureTemplate(privKey))
        .to(receipient, amt)
        .to(serviceProviderAddr, 2000)
        .build()
      // .send();
      // console.log("TX ", tx)
      const chronik = new ChronikClient("https://chronik.be.cash/xec")
      const chronikNet = new ChronikNetworkProvider("mainnet", chronik)
      const txRes = await chronikNet.sendRawTransaction(tx)
      log(txRes)
      return tx
    } catch (error) {
      console.error(error);
   
    }
  
  
  
  }
  