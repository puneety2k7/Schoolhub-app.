import argon2 from 'argon2';
export const hashPassword=(password:string)=>argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
export const verifyPassword=(hash:string,password:string)=>argon2.verify(hash,password);
export function validatePassword(value:string){return value.length>=12&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/[0-9]/.test(value)&&/[^A-Za-z0-9]/.test(value);}
