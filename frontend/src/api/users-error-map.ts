const errorMessages: Record<string, string> = {
  VALIDATION_ERROR: "Dữ liệu nhập chưa hợp lệ. Vui lòng kiểm tra lại.",
  USER_EMAIL_ALREADY_EXISTS: "Email đã tồn tại trong hệ thống.",
  USER_USERNAME_ALREADY_EXISTS: "Tên đăng nhập đã tồn tại trong hệ thống.",
  USER_ROLE_INVALID: "Vai trò không hợp lệ.",
  USER_NOT_FOUND: "Không tìm thấy người dùng.",
  USER_INACTIVE: "Tài khoản đã bị vô hiệu hóa.",
  USER_PERMISSION_DENIED: "Bạn không có quyền thao tác trên người dùng này.",
  USER_PASSWORD_WEAK: "Mật khẩu chưa đạt yêu cầu bảo mật.",
  AUTH_INVALID_CREDENTIALS: "Tên đăng nhập hoặc mật khẩu không đúng.",
  CONFLICT: "Dữ liệu xung đột, vui lòng thử lại.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
  NOT_FOUND: "Không tìm thấy dữ liệu yêu cầu.",
  ROLE_NOT_FOUND: "Không tìm thấy vai trò.",
  ROLE_SYSTEM_PROTECTED: "Không thể sửa hoặc xóa vai trò hệ thống.",
  ROLE_IN_USE: "Vai trò đang được sử dụng.",
  ROLE_NAME_ALREADY_EXISTS: "Tên vai trò đã tồn tại.",
  PERMISSION_NOT_FOUND: "Một hoặc nhiều quyền không tồn tại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  UNAUTHORIZED: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
  SERVICE_UNAVAILABLE: "Không thể kết nối tới máy chủ.",
};

export const getMessageByErrorCode = (
  errorCode: string,
  fallback?: string,
): string => {
  return errorMessages[errorCode] || fallback || "Có lỗi xảy ra. Vui lòng thử lại.";
};
