export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // If you also want to force re-selecting a production, uncomment:
  // localStorage.removeItem('currentProductionId');
}