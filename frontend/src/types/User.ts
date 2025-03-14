export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
}

export interface UserPassword {
    id: number;
    oldPassword: string;
    newPassword: string;
}