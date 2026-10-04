export class ApiError extends Error {
  constructor(public code:string, message:string, public status=400, public details?:unknown){super(message);this.name='ApiError';}
}
export const deny=(code:string,message='The requested operation is not permitted.',status=403)=>new ApiError(code,message,status);
