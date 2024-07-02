import { RPCHandler, HandlerConstructorConfig } from "@ubiquity-dao/rpc-handler/";
import { ethers } from "ethers";

/**
 * Returns ERC20 token symbol
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @returns ERC20 token symbol
 */
export async function getERC20TokenSymbol(networkId: number, tokenAddress: string) {
  const abi = ["function symbol() view returns (string)"];

  // get fastest RPC
  const config: HandlerConstructorConfig = {
    networkId: networkId,
    rpcTimeout: 1500,
    autoStorage: false,
    cacheRefreshCycles: 10,
  };
  const handler = new RPCHandler(config);
  const provider = await handler.getFastestRpcProvider();

  // fetch token symbol
  const contract = new ethers.Contract(tokenAddress, abi, provider)
  return await contract.symbol();
}
