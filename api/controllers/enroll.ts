import { Request, Response } from 'express';
import { caClientExaminers, caClientStudents, pool } from '../app';
import { issueIdentity } from '../utils/CAUtil';

const examinersMspId = 'ExaminersMSP';
const studentsMspId = 'StudentsMSP';

const enrollExaminers = async (req: Request, res: Response) => {
  const { name, username, secret } = req.body;

  // Validate input
  if (!name || !username || !secret) {
    return res.status(400).json({ error: 'Name, username and secret are required' });
  }

  try {
    // Check if examiner exists
    const { rowCount } = await pool.query(
      'SELECT 1 FROM examiners WHERE email = $1', 
      [username]
    );

    if (rowCount > 0) {
      return res.status(409).json({ error: 'Examiner already enrolled' });
    }

    // Issue identity (modified to return instead of respond)
    const identity = await issueIdentity(
      res,
      username, 
      secret, 
      caClientExaminers, 
      examinersMspId, 
      [
        { name: 'Name', optional: false },
        { name: 'Email', optional: false }
      ]
    );

    // Insert into database
    await pool.query(
      'INSERT INTO examiners (email, name) VALUES ($1, $2)',
      [username, name]
    );

    // Send single response
    return res.status(201).json({ 
      success: true,
      message: 'Successfully enrolled examiner',
      username,
      name
    });

  } catch (error) {
    console.error('Enrollment error:', error);
    return res.status(500).json({ 
      error: 'Enrollment failed',
      details: error.message 
    });
  }
};

const enrollStudents = async (req: Request, res: Response) => {
  const {
    name,
    username,
    secret,
    rollNumber,
  }: { name: string, username: string; secret: string, rollNumber: string } = req.body;

  if (name && username && secret && rollNumber) {
    const exists = await pool.query('SELECT * FROM students WHERE roll = $1', [rollNumber]);
    if (!exists.rowCount) {
      await issueIdentity(res, username, secret, caClientStudents, studentsMspId, [
        {
          name: 'Name',
          optional: false,
        },
        {
          name: 'Email',
          optional: false,
        },
        {
          name: 'RollNumber',
          optional: false,
        },
      ]);
      await pool.query('INSERT INTO students VALUES($1, $2, $3)', [rollNumber, name, username]);
    } else {
      res.status(409).json({ error: 'Student already enrolled' });
    }
  } else {
    res.status(401).json({ error: 'Name, username, secret and roll number are required' });
  }
};

export { enrollExaminers, enrollStudents };
