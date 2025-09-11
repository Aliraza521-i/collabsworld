// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
    },
   
    phoneNumber: {
      type: String,
    },
    role: {
      type: String,
      enum: ['publisher', 'advertiser', 'admin'],
      default: 'publisher',
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    favorites: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website'
    }]
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

export default User;