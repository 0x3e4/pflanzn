export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    /** The admin created from ADMIN_USER (only in admin responses). */
    is_default_admin?: boolean;
}

export interface UserPassword {
    id: number;
    oldPassword: string;
    newPassword: string;
}
