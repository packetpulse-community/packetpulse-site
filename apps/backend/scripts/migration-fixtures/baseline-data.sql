-- Fixture rows for `check-migrations.sh copy`. Written for the schema as it stands after
-- migration 20260910101403_password_hash_nullable (BASELINE_MIGRATION): BEFORE the shared
-- categories migration (enum categories, forum_categories table), BEFORE the audit-log
-- append-only migration and BEFORE private files. Synthetic data only, no real people.
-- If you move BASELINE_MIGRATION, rewrite this file for that schema and update
-- post-checks.sql.
BEGIN;

INSERT INTO roles (id, name, description) VALUES
  ('fx-role-admin', 'fx_admin', 'fixture admin'),
  ('fx-role-member', 'fx_member', 'fixture member');

INSERT INTO users (id, first_name, last_name, email, password_hash, is_approved, email_verified, created_at, updated_at) VALUES
  ('fx-user-admin', 'Ada',  'Admin',  'fx-admin@example.invalid',  'x', true,  true,  now(), now()),
  ('fx-user-mod',   'Max',  'Mod',    'fx-mod@example.invalid',    'x', true,  true,  now(), now()),
  ('fx-user-a',     'Alice','Member', 'fx-a@example.invalid',      'x', true,  true,  now(), now()),
  ('fx-user-b',     'Bob',  'Member', 'fx-b@example.invalid',      NULL, false, false, now(), now());  -- NULL hash: social-login style row

INSERT INTO user_roles (user_id, role_id) VALUES
  ('fx-user-admin', 'fx-role-admin'), ('fx-user-admin', 'fx-role-member'),
  ('fx-user-mod',   'fx-role-admin'),
  ('fx-user-a',     'fx-role-member'), ('fx-user-b', 'fx-role-member');

-- Forum: old forum_categories table, threads pointing at it, nested replies, a like.
INSERT INTO forum_categories (id, name, slug, position) VALUES
  ('fx-fcat-ccna', 'CCNA', 'ccna', 1),
  ('fx-fcat-sec',  'Security', 'security', 4);

INSERT INTO forum_threads (id, category_id, author_id, title, content, slug, reply_count, updated_at) VALUES
  ('fx-thread-1', 'fx-fcat-ccna', 'fx-user-a', 'OSPF stuck in EXSTART', 'MTU mismatch?', 'ospf-stuck-in-exstart', 2, now()),
  ('fx-thread-2', 'fx-fcat-sec',  'fx-user-b', 'ACL order',             'Does order matter?', 'acl-order', 1, now());

INSERT INTO forum_replies (id, thread_id, author_id, content, parent_reply_id, updated_at) VALUES
  ('fx-reply-1', 'fx-thread-1', 'fx-user-b', 'Check the MTU on both ends.', NULL, now()),
  ('fx-reply-2', 'fx-thread-1', 'fx-user-a', 'That was it, thanks.', 'fx-reply-1', now()),
  ('fx-reply-3', 'fx-thread-2', 'fx-user-a', 'Yes, first match wins.', NULL, now());
INSERT INTO forum_reply_likes (reply_id, user_id) VALUES ('fx-reply-1', 'fx-user-a');

-- Blog and quizzes with the OLD enum category column (network_automation is the one the
-- shared-categories migration has to map to the slug network-automation).
INSERT INTO blog_posts (id, title, slug, content, author_id, category, updated_at) VALUES
  ('fx-blog-1', 'Intro to Netmiko', 'intro-to-netmiko', 'body', 'fx-user-admin', 'network_automation', now()),
  ('fx-blog-2', 'Subnetting basics', 'subnetting-basics', 'body', 'fx-user-a', 'ccna', now());

INSERT INTO quizzes (id, title, description, category, passing_score_pct, is_published, created_by_id, updated_at) VALUES
  ('fx-quiz-1', 'Automation 101', 'desc', 'network_automation', 70, true, 'fx-user-admin', now()),
  ('fx-quiz-2', 'CCNA warm-up',   'desc', 'ccna', 60, true, 'fx-user-admin', now());

INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, position) VALUES
  ('fx-q-1', 'fx-quiz-1', 'Which library speaks SSH to network gear?', 'single_choice', 0),
  ('fx-q-2', 'fx-quiz-2', 'Pick the private ranges', 'multi_choice', 0);
INSERT INTO quiz_question_options (id, question_id, option_text, is_correct, position) VALUES
  ('fx-o-1', 'fx-q-1', 'Netmiko', true, 0),
  ('fx-o-2', 'fx-q-1', 'Pillow', false, 1),
  ('fx-o-3', 'fx-q-2', '10.0.0.0/8', true, 0),
  ('fx-o-4', 'fx-q-2', '8.8.8.0/24', false, 1);

INSERT INTO quiz_attempts (id, quiz_id, user_id, submitted_at, score_pct, passed, status) VALUES
  ('fx-att-1', 'fx-quiz-1', 'fx-user-a', now(), 100, true,  'submitted'),
  ('fx-att-2', 'fx-quiz-2', 'fx-user-a', now(), 40,  false, 'submitted'),
  ('fx-att-3', 'fx-quiz-1', 'fx-user-b', NULL,  NULL, NULL, 'in_progress');
INSERT INTO quiz_attempt_answers (id, attempt_id, question_id, selected_option_ids, is_correct) VALUES
  ('fx-ans-1', 'fx-att-1', 'fx-q-1', ARRAY['fx-o-1'], true),
  ('fx-ans-2', 'fx-att-2', 'fx-q-2', ARRAY['fx-o-4'], false);
INSERT INTO certificates (id, user_id, quiz_id, quiz_attempt_id, certificate_number) VALUES
  ('fx-cert-1', 'fx-user-a', 'fx-quiz-1', 'fx-att-1', 'FX-CERT-0001');

INSERT INTO notifications (id, user_id, type, payload, read_at) VALUES
  ('fx-n-1', 'fx-user-a', 'forum_reply', '{"threadId":"fx-thread-1"}', NULL),
  ('fx-n-2', 'fx-user-a', 'certificate_issued', '{"certificateId":"fx-cert-1"}', now()),
  ('fx-n-3', 'fx-user-b', 'approval', '{}', NULL);

-- Staff activity log: two rows by the moderator (deleted later), one by the admin, one
-- orphaned row with no actor. The audit migration must apply over these.
INSERT INTO admin_activity_logs (id, actor_id, action, target_type, target_id, details) VALUES
  ('fx-log-1', 'fx-user-mod',   'user_approved', 'user', 'fx-user-a', '{"note":"ok"}'),
  ('fx-log-2', 'fx-user-mod',   'blog_approved', 'blog', 'fx-blog-1', NULL),
  ('fx-log-3', 'fx-user-admin', 'user_roles_changed', 'user', 'fx-user-b', '{"added":["fx_member"]}'),
  ('fx-log-4', NULL,            'user_deleted', 'user', 'gone-user', NULL);

COMMIT;
