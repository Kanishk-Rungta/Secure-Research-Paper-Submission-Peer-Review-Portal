// Access Control List enforcement

const ACL = {
  Author: {
    Paper: ['create', 'read', 'update'],
    Review: [],
    FinalDecision: ['read']
  },
  Collaborator: {
    Paper: ['read', 'update'],
    Review: ['read'],
    FinalDecision: ['create', 'read']
  },
  Reviewer: {
    Paper: ['read'],
    Review: ['create'],
    FinalDecision: []
  }
};

function checkAccess(role, objectType, action) {
  const rolePerms = ACL[role];
  if (!rolePerms) return false;
  const allowed = rolePerms[objectType] || [];
  return allowed.includes(action);
}

module.exports = { checkAccess, ACL };
