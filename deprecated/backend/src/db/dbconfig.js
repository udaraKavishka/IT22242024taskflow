const mongoose = require("mongoose");
require('dotenv').config();
const url= process.env.MONGODB_URI;

mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

const connectDB = () => {
    mongoose.connect(url).then(()=>{
        console.log("DB Connected");
    }).catch((err)=>{
        console.log("DB Connection Error: ", err);
    });
}

module.exports={
    connectDB
} 
