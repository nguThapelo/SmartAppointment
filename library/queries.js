export const queryKeys = {
  GET_USERS: 'SELECT * FROM public."User"',
  GET_USER_BY_ID: 'SELECT * FROM public."User" WHERE id = $1',
};
