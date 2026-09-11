import { relations } from "drizzle-orm";
import { organizationMembers, organizations, users } from "./core";
import {
  credentials,
  expertiseClaims,
  domains,
  languages,
  professionalLanguages,
  professionalProfiles,
  serviceCategories,
  serviceListings,
} from "./professional";
import { assignmentParticipants, assignments, attachments, messages, offers } from "./assignment";
import { artifactVersions, artifacts, contributions, reviewComments, signatures } from "./artifacts";
import { authorshipRecords, publishedWorks, reviews } from "./records";

export const usersRelations = relations(users, ({ one, many }) => ({
  professionalProfile: one(professionalProfiles, { fields: [users.id], references: [professionalProfiles.userId] }),
  memberships: many(organizationMembers),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  assignments: many(assignments),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const professionalProfilesRelations = relations(professionalProfiles, ({ one, many }) => ({
  user: one(users, { fields: [professionalProfiles.userId], references: [users.id] }),
  languages: many(professionalLanguages),
  expertise: many(expertiseClaims),
  credentials: many(credentials),
  listings: many(serviceListings),
}));

export const professionalLanguagesRelations = relations(professionalLanguages, ({ one }) => ({
  profile: one(professionalProfiles, { fields: [professionalLanguages.profileId], references: [professionalProfiles.id] }),
  language: one(languages, { fields: [professionalLanguages.languageCode], references: [languages.code] }),
}));

export const expertiseClaimsRelations = relations(expertiseClaims, ({ one }) => ({
  profile: one(professionalProfiles, { fields: [expertiseClaims.profileId], references: [professionalProfiles.id] }),
  domain: one(domains, { fields: [expertiseClaims.domainId], references: [domains.id] }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  profile: one(professionalProfiles, { fields: [credentials.profileId], references: [professionalProfiles.id] }),
}));

export const serviceListingsRelations = relations(serviceListings, ({ one }) => ({
  profile: one(professionalProfiles, { fields: [serviceListings.profileId], references: [professionalProfiles.id] }),
  category: one(serviceCategories, { fields: [serviceListings.categoryId], references: [serviceCategories.id] }),
  language: one(languages, { fields: [serviceListings.languageCode], references: [languages.code] }),
  domain: one(domains, { fields: [serviceListings.domainId], references: [domains.id] }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  customer: one(users, { fields: [assignments.customerUserId], references: [users.id] }),
  organization: one(organizations, { fields: [assignments.organizationId], references: [organizations.id] }),
  professional: one(users, { fields: [assignments.primaryProfessionalUserId], references: [users.id] }),
  category: one(serviceCategories, { fields: [assignments.serviceCategoryId], references: [serviceCategories.id] }),
  language: one(languages, { fields: [assignments.languageCode], references: [languages.code] }),
  domain: one(domains, { fields: [assignments.domainId], references: [domains.id] }),
  participants: many(assignmentParticipants),
  offers: many(offers),
  messages: many(messages),
  artifacts: many(artifacts),
  attachments: many(attachments),
  contributions: many(contributions),
}));

export const assignmentParticipantsRelations = relations(assignmentParticipants, ({ one }) => ({
  assignment: one(assignments, { fields: [assignmentParticipants.assignmentId], references: [assignments.id] }),
  user: one(users, { fields: [assignmentParticipants.userId], references: [users.id] }),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  assignment: one(assignments, { fields: [offers.assignmentId], references: [assignments.id] }),
  professional: one(users, { fields: [offers.professionalUserId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  assignment: one(assignments, { fields: [messages.assignmentId], references: [assignments.id] }),
  sender: one(users, { fields: [messages.senderUserId], references: [users.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  owner: one(users, { fields: [attachments.ownerUserId], references: [users.id] }),
}));

export const artifactsRelations = relations(artifacts, ({ one, many }) => ({
  assignment: one(assignments, { fields: [artifacts.assignmentId], references: [assignments.id] }),
  versions: many(artifactVersions),
}));

export const artifactVersionsRelations = relations(artifactVersions, ({ one, many }) => ({
  artifact: one(artifacts, { fields: [artifactVersions.artifactId], references: [artifacts.id] }),
  createdBy: one(users, { fields: [artifactVersions.createdByUserId], references: [users.id] }),
  comments: many(reviewComments),
}));

export const reviewCommentsRelations = relations(reviewComments, ({ one }) => ({
  version: one(artifactVersions, { fields: [reviewComments.versionId], references: [artifactVersions.id] }),
  author: one(users, { fields: [reviewComments.authorUserId], references: [users.id] }),
}));

export const contributionsRelations = relations(contributions, ({ one }) => ({
  assignment: one(assignments, { fields: [contributions.assignmentId], references: [assignments.id] }),
  user: one(users, { fields: [contributions.userId], references: [users.id] }),
  version: one(artifactVersions, { fields: [contributions.versionId], references: [artifactVersions.id] }),
}));

export const signaturesRelations = relations(signatures, ({ one }) => ({
  signer: one(users, { fields: [signatures.signerUserId], references: [users.id] }),
  version: one(artifactVersions, { fields: [signatures.versionId], references: [artifactVersions.id] }),
}));

export const authorshipRecordsRelations = relations(authorshipRecords, ({ one, many }) => ({
  professional: one(users, { fields: [authorshipRecords.professionalUserId], references: [users.id] }),
  assignment: one(assignments, { fields: [authorshipRecords.assignmentId], references: [assignments.id] }),
  publishedWorks: many(publishedWorks),
}));

export const publishedWorksRelations = relations(publishedWorks, ({ one }) => ({
  record: one(authorshipRecords, { fields: [publishedWorks.recordId], references: [authorshipRecords.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  assignment: one(assignments, { fields: [reviews.assignmentId], references: [assignments.id] }),
  professional: one(users, { fields: [reviews.professionalUserId], references: [users.id] }),
}));
