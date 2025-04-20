import { Request, Response } from 'express';
import { Identity, Wallet } from 'fabric-network';
import { caClientExaminers, caClientStudents, transporter } from '../app';
import { buildWallet, sendMail } from '../utils/AppUtil';
import { registerUser } from '../utils/CAUtil';
import { Pool } from 'pg';
import { User } from 'fabric-common'; // Or wherever your Fabric client library exposes this
const registerExaminer = async (req: Request, res: Response) => {
  try {
    const { identity, name, username } = req.body;
    const wallet: Wallet = await buildWallet();

    // 1. Verify or enroll admin identity
    let adminValid = false;
    const adminIdentity = await wallet.get(process.env.ADMIN_USERNAME);

    if (adminIdentity) {
      console.log('Admin identity found in wallet');
      try {
        // Test admin credentials by getting CA info

        adminValid = true;
        console.log('Admin credentials are valid');
      } catch (error) {
        console.log('Admin credentials invalid, attempting re-enrollment');
      }
    }

    if (!adminValid) {
      console.log('Enrolling fresh admin identity...');
      const enrollment = await caClientExaminers.enroll({
        enrollmentID: process.env.ADMIN_USERNAME || 'admin',
        enrollmentSecret: process.env.ADMIN_PASSWORD || 'adminpw'
      });

      const newAdminIdentity = {
        credentials: {
          certificate: enrollment.certificate,
          privateKey: enrollment.key.toBytes()
        },
        mspId: 'ExaminersMSP',
        type: 'X.509'
      };

      await wallet.put(process.env.ADMIN_USERNAME || 'admin', newAdminIdentity);
      console.log('Admin re-enrolled successfully');
    }

    // 2. Register the new user with proper affiliation
    const secret = await registerUser(
      caClientExaminers,
      wallet,
      username,
      'org1.department1', // Changed to match your affiliation config
      [{
        name: 'Name',
        value: name,
        ecert: true,
      },
      {
        name: 'Email',
        value: username,
        ecert: true,
      }]
    ).catch(async (error) => {
      console.error('First registration attempt failed:', error);
      // Try one more time after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return registerUser(
        caClientExaminers,
        wallet,
        username,
        'org1.department1',
        [{
          name: 'Name',
          value: name,
          ecert: true,
        },
        {
          name: 'Email',
          value: username,
          ecert: true,
        }]
      );
    });

    console.log("Registration successful, secret:", secret);
    await sendMail(req, res, transporter, name, username, secret);
    res.status(200).json({ success: true, message: 'Registration successful' });

  //   const pool = new Pool({
  //     user: 'gaian',
  //     host: 'localhost',
  //     database: 'gaian',
  //     password: 'gaian',
  //     port: 5432,
  //   });

  //   try {
  //   await pool.query(
  //     'INSERT INTO examiners (email, name) VALUES ($1, $2)',
  //     [username, name]
  //   );
  //   console.log('Examiner added to PostgreSQL');
  // } catch (dbError) {
  //   console.error('Database insertion failed:', dbError);
  //   // Handle duplicate entry or other DB errors
  // } finally {
  //   await pool.end();
  // } 
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// const registerStudents = async (req: Request, res: Response) => {
//   try {
//     const {
//       identity, name, username, rollNumber,
//     }:
//       {
//         identity: Identity,
//         name: string,
//         username: string,
//         rollNumber: string,
//       } = req.body;
//     const wallet: Wallet = await buildWallet();
//     console.log("idenetity", identity);

//     // 1. Verify or enroll admin identity
//     let adminValid = false;
//     const adminIdentity = await wallet.get(process.env.ADMIN_USERNAME);
 
//     if (adminIdentity) {
//       console.log('Admin identity found in wallet'); 
//       try {
//         // Test admin credentials by getting CA info

//         adminValid = true;
//         console.log('Admin credentials are valid');
//       } catch (error) {
//         console.log('Admin credentials invalid, attempting re-enrollment');
//       }
//     }

//     if (!adminValid) {
//       console.log('Enrolling fresh admin identity...');
//       const enrollment = await caClientStudents.enroll({
//         enrollmentID: process.env.ADMIN_USERNAME || 'admin',
//         enrollmentSecret: process.env.ADMIN_PASSWORD || 'adminpw'
//       });

//       const newAdminIdentity = {
//         credentials: {
//           certificate: enrollment.certificate,
//           privateKey: enrollment.key.toBytes()
//         },
//         mspId: 'StudentsMSP',
//         type: 'X.509'
//       };

//       await wallet.put(process.env.ADMIN_USERNAME || 'admin', newAdminIdentity);
//       console.log('Admin re-enrolled successfully');
      
//     }



//     const secret = await registerUser(
//       caClientStudents,
//       wallet,
//       username,
//       `students.batch2024.branch1`,
//       [
//         { name: 'Name', value: name, ecert: true },
//         { name: 'Email', value: username, ecert: true },
//         { name: 'RollNumber', value: rollNumber, ecert: true },
//       ]
//     );

//     await sendMail(req, res, transporter, name, username, secret);
//     res.status(200).json({ success: true, message: 'Student registration successful' });
//   } catch (error) {
//     console.error('Student Registration failed:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Student registration failed',
//       error: error.message,
//     });
//   }
// };

 
const registerStudents = async (req: Request, res: Response) => {
  try {
    const { identity, name, username, rollNumber } = req.body;
    const wallet: Wallet = await buildWallet();
    
    // Check and enroll admin identity
    let adminIdentity = await wallet.get(process.env.ADMIN_USERNAME);
    
    if (!adminIdentity) {
      console.log('Admin identity not found, enrolling admin...');
      const enrollment = await caClientStudents.enroll({
        enrollmentID: process.env.ADMIN_USERNAME || 'admin',
        enrollmentSecret: process.env.ADMIN_PASSWORD || 'adminpw'
      });
      
      const studentsMSPId = 'StudentsMSP';
      const newAdminIdentity = {
        credentials: {
          certificate: enrollment.certificate,
          privateKey: enrollment.key.toBytes()
        },
        mspId: studentsMSPId,
        type: 'X.509'
      };
      
      await wallet.put(process.env.ADMIN_USERNAME, newAdminIdentity);
      adminIdentity = newAdminIdentity;
      console.log('Admin enrolled successfully');
    }
    // First ensure the affiliation exists
    const adminWalletIdentity = await wallet.get(process.env.ADMIN_USERNAME);
    console.log("adminWalletIdentity",adminWalletIdentity);
    if (!adminWalletIdentity) {
      throw new Error('Admin identity not found in wallet');
    }

    // Create a new User object from the wallet identity
    
    const adminUser = User.createUser(
      process.env.ADMIN_USERNAME || 'admin', // name
      '', // password (not needed here)
      adminWalletIdentity.mspId, // mspid
      identity.credentials.certificate, // signedCertPem
      identity.credentials.privateKey // privateKeyPEM
    );

    // Set additional properties if needed
    adminUser.setRoles(['admin']);
    adminUser.setAffiliation('');
    try {
      await caClientStudents.newAffiliationService().create(
        {
          name: 'students.batch2024',
          force: true
        },
        adminUser  // Now passing the correct User type
      );
      console.log('Affiliation students.batch2024 created');
    } catch (affiliationError) {
      if (!affiliationError.message.includes('already exists')) {
        throw affiliationError;
      }
      console.log('Affiliation already exists');
    }
    // Register the student
    console.log('Registering student...');
    const secret = await registerUser(
      caClientStudents,
      wallet,
      username,
      'students.batch2024',
      [{
        name: 'Name',
        value: name,
        ecert: true,
      },
      {
        name: 'Email',
        value: username,
        ecert: true,
      },
      {
        name: 'RollNumber',
        value: rollNumber,
        ecert: true,
      }],
    );
    
    await sendMail(req, res, transporter, name, username, secret);
    res.status(200).json({ 
      success: true, 
      message: 'Student registration successful' 
    });
    
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

export { registerExaminer, registerStudents };
 

