import jwt from 'jsonwebtoken';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET, // Add this to your .env file
    {
      expiresIn: '7d'
    }
  );
};

export default generateToken;