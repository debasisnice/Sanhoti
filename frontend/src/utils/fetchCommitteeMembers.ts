import { committeeAPI, boardMembersAPI } from '../services/api';
import { COMMITTEE_ROLES } from '../constants/committeeRoles';

export interface CommitteeMemberDisplay {
  role: string;
  firstName: string;
  lastName: string;
  image: string;
}

/** Same data source as the public /committee page. */
export async function fetchCommitteeMembers(): Promise<CommitteeMemberDisplay[]> {
  const [members, boardMemberImages] = await Promise.all([
    committeeAPI.getMembers(),
    boardMembersAPI.getImages(),
  ]);

  const membersMap = new Map<string, { firstName: string; lastName: string }>();
  members.forEach((member: { role?: string; firstName?: string; lastName?: string; first_name?: string; last_name?: string }) => {
    if (member.role) {
      membersMap.set(member.role, {
        firstName: member.firstName || member.first_name || '',
        lastName: member.lastName || member.last_name || '',
      });
    }
  });

  const imagesMap = new Map<string, string>();
  boardMemberImages.forEach((img: { postName?: string; url?: string }) => {
    if (img.postName && img.url) imagesMap.set(img.postName, img.url);
  });

  return COMMITTEE_ROLES.map(role => {
    const memberData = membersMap.get(role);
    return {
      role,
      firstName: memberData?.firstName || '',
      lastName: memberData?.lastName || '',
      image: imagesMap.get(role) || '',
    };
  });
}
