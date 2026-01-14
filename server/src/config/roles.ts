export enum Role {
  USER = 'USER',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN'
}

const allRoles = {
  [Role.USER]: ['getUsers', 'getTemplates', 'getDocuments', 'manageDocuments'],
  [Role.MANAGER]: ['getUsers', 'manageUsers', 'manageTemplates', 'getTemplates', 'getDocuments', 'manageDocuments'],
  [Role.ADMIN]: ['getUsers', 'manageUsers', 'manageTemplates', 'getTemplates', 'getDocuments', 'manageDocuments']
};

export const roles = Object.keys(allRoles);
export const roleRights = new Map(Object.entries(allRoles));
