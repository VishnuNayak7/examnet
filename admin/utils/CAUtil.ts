/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import dotenv from 'dotenv';
import FabricCAServices, { IKeyValueAttribute } from 'fabric-ca-client';
import { Wallet, Identity } from 'fabric-network';

dotenv.config();

const adminUserId = process.env.ADMIN_USERNAME;
const adminUserPasswd = process.env.ADMIN_PW;

/**
 *
 * @param {*} ccp
 */
const buildCAClient = (
  ccp: Record<string, any>,
  caHostName: string,
): FabricCAServices => {
  // Create a new CA client for interacting with the CA.
  const caInfo = ccp.certificateAuthorities[caHostName]; // lookup CA details from config
  const caTLSCACerts = caInfo.tlsCACerts.pem;
  const caClient = new FabricCAServices(
    caInfo.url,
    { trustedRoots: caTLSCACerts, verify: false },
    caInfo.caName,
  );

  console.log(`Built a CA Client named ${caInfo.caName}`);
  return caClient;
};

const enrollAdmin = async (
  caClient: FabricCAServices,
  orgMspId: string,
): Promise<Identity> => {
  try {
    // Check to see if we've already enrolled the admin user.
    // const identity = await wallet.get(adminUserId);
    // if (identity) {
    //   throw new Error('An identity for the admin user already exists in the wallet');
    // }
    // Enroll the admin user, and import the new identity into the wallet.
    const enrollment = await caClient.enroll({
      enrollmentID: adminUserId,
      enrollmentSecret: adminUserPasswd,
    });
    const x509Identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes(),
      },
      mspId: orgMspId,
      type: 'X.509',
    };
    // await wallet.put(adminUserId, x509Identity);
    console.log(
      'Successfully enrolled admin user and imported it into the wallet',
    );
    return x509Identity;
  } catch (error) {
    console.error(`Failed to enroll admin user : ${error}`);
    return null;
  }
};

const registerUser = async (
  caClient: FabricCAServices,
  wallet: Wallet,
  userId: string,
  affiliation: string,
  attributes?: IKeyValueAttribute[],
): Promise<string> => {
  // Check to see if we've already enrolled the user
  const userIdentity = await wallet.get(userId);
  if (userIdentity) {
    throw new Error(
      `An identity for the user ${userId} already exists in the wallet`,
    );
  }
  console.log("passed");

  // Must use an admin to register a new user
  const adminIdentity = await wallet.get(adminUserId);
  if (!adminIdentity) {
    throw new Error(
      'An identity for the admin user does not exist in the wallet',
    );
  }
  console.log("passed2");

  // build a user object for authenticating with the CA
  const provider = wallet
    .getProviderRegistry()
    .getProvider(adminIdentity.type);
  const adminUser = await provider.getUserContext(
    adminIdentity,
    adminUserId,
  );
  console.log("passed3");

  // Register the user, enroll the user, and import the new identity into the wallet.
  // if affiliation is specified by client, the affiliation value must be configured in CA
  console.log("data secret",affiliation,userId,attributes,adminUser);
  
  const secret = await caClient.register(
    {
      affiliation,
      enrollmentID: userId,
      role: 'client',
      attrs: attributes,
      maxEnrollments: 1,
    },
    adminUser,
  ).catch(err => {
    console.error('Detailed CA registration error:', {
      message: err.message,
      stack: err.stack,
      response: err.response?.body,
      statusCode: err.response?.statusCode
    });
    throw err;
  });

  console.log("passed4", secret);


  console.log(
    `Successfully registered user ${userId}`,
  );
  return secret;
};




export { buildCAClient, enrollAdmin, registerUser };
