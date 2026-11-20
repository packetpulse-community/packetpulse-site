-- Assertions for `check-migrations.sh copy`, run AFTER every migration has been applied
-- on top of baseline-data.sql. Any failed assertion aborts with a non-zero exit.
\set ON_ERROR_STOP on

DO $$
DECLARE n integer;
BEGIN
  -- Rows survived.
  SELECT count(*) INTO n FROM users;                 IF n <> 4 THEN RAISE EXCEPTION 'users: expected 4, got %', n; END IF;
  SELECT count(*) INTO n FROM user_roles;            IF n <> 5 THEN RAISE EXCEPTION 'user_roles: expected 5, got %', n; END IF;
  SELECT count(*) INTO n FROM forum_threads;         IF n <> 2 THEN RAISE EXCEPTION 'forum_threads: expected 2, got %', n; END IF;
  SELECT count(*) INTO n FROM forum_replies;         IF n <> 3 THEN RAISE EXCEPTION 'forum_replies: expected 3, got %', n; END IF;
  SELECT count(*) INTO n FROM quizzes;               IF n <> 2 THEN RAISE EXCEPTION 'quizzes: expected 2, got %', n; END IF;
  SELECT count(*) INTO n FROM quiz_attempts;         IF n <> 3 THEN RAISE EXCEPTION 'quiz_attempts: expected 3, got %', n; END IF;
  SELECT count(*) INTO n FROM certificates;          IF n <> 1 THEN RAISE EXCEPTION 'certificates: expected 1, got %', n; END IF;
  SELECT count(*) INTO n FROM notifications;         IF n <> 3 THEN RAISE EXCEPTION 'notifications: expected 3, got %', n; END IF;
  SELECT count(*) INTO n FROM admin_activity_logs;   IF n <> 4 THEN RAISE EXCEPTION 'admin_activity_logs: expected 4, got %', n; END IF;
  SELECT count(*) INTO n FROM blog_posts;            IF n <> 2 THEN RAISE EXCEPTION 'blog_posts: expected 2, got %', n; END IF;

  -- shared_categories backfill mapped the enum values (underscore -> hyphen slug).
  SELECT count(*) INTO n FROM quizzes q JOIN categories c ON c.id = q.category_id
    WHERE (q.id = 'fx-quiz-1' AND c.slug = 'network-automation') OR (q.id = 'fx-quiz-2' AND c.slug = 'ccna');
  IF n <> 2 THEN RAISE EXCEPTION 'quiz category backfill wrong'; END IF;
  SELECT count(*) INTO n FROM blog_posts b JOIN categories c ON c.id = b.category_id
    WHERE (b.id = 'fx-blog-1' AND c.slug = 'network-automation') OR (b.id = 'fx-blog-2' AND c.slug = 'ccna');
  IF n <> 2 THEN RAISE EXCEPTION 'blog category backfill wrong'; END IF;
  -- Threads were re-pointed from forum_categories to categories by slug.
  SELECT count(*) INTO n FROM forum_threads t JOIN categories c ON c.id = t.category_id
    WHERE (t.id = 'fx-thread-1' AND c.slug = 'ccna') OR (t.id = 'fx-thread-2' AND c.slug = 'security');
  IF n <> 2 THEN RAISE EXCEPTION 'forum thread category repoint wrong'; END IF;

  -- Audit migration: new column is NULL for old rows, triggers exist.
  SELECT count(*) INTO n FROM admin_activity_logs WHERE reason IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'old log rows should have NULL reason'; END IF;
  SELECT count(*) INTO n FROM pg_trigger WHERE tgname IN ('admin_activity_logs_no_update_delete', 'admin_activity_logs_no_truncate', 'file_access_logs_no_update_delete');
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 append-only triggers, got %', n; END IF;
END $$;

-- The new enum values can be used (ADD VALUE committed) and a reason stored.
INSERT INTO admin_activity_logs (id, actor_id, action, target_type, reason)
  VALUES ('fx-log-5', 'fx-user-admin', 'site_settings_changed', 'site_settings', 'rehearsal');

-- The table is append-only: UPDATE, DELETE and TRUNCATE are refused, each with the
-- restrict_violation error code.
DO $$
BEGIN
  BEGIN UPDATE admin_activity_logs SET details = '{}' WHERE id = 'fx-log-3'; RAISE EXCEPTION 'UPDATE was allowed';
  EXCEPTION WHEN restrict_violation THEN NULL; END;
  BEGIN DELETE FROM admin_activity_logs WHERE id = 'fx-log-3'; RAISE EXCEPTION 'DELETE was allowed';
  EXCEPTION WHEN restrict_violation THEN NULL; END;
  BEGIN TRUNCATE admin_activity_logs; RAISE EXCEPTION 'TRUNCATE was allowed';
  EXCEPTION WHEN restrict_violation THEN NULL; END;
  -- Changing actor_id to a different non-null value is not the allowed exception.
  BEGIN UPDATE admin_activity_logs SET actor_id = 'fx-user-a' WHERE id = 'fx-log-3'; RAISE EXCEPTION 'actor swap was allowed';
  EXCEPTION WHEN restrict_violation THEN NULL; END;
END $$;

-- Deleting a user whose id appears as actor_id must still work: the ON DELETE SET NULL
-- foreign key runs an UPDATE of actor_id to NULL, which the trigger allows. All rows stay.
DELETE FROM users WHERE id = 'fx-user-mod';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM admin_activity_logs;
  IF n <> 5 THEN RAISE EXCEPTION 'log rows lost after deleting the actor: expected 5, got %', n; END IF;
  SELECT count(*) INTO n FROM admin_activity_logs WHERE id IN ('fx-log-1', 'fx-log-2') AND actor_id IS NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'actor_id was not set to NULL for the deleted moderator (got % rows)', n; END IF;
  SELECT count(*) INTO n FROM admin_activity_logs WHERE id = 'fx-log-3' AND actor_id = 'fx-user-admin';
  IF n <> 1 THEN RAISE EXCEPTION 'unrelated log row changed'; END IF;
END $$;

-- Private files tables exist and the access log is append-only.
INSERT INTO stored_files (id, owner_id, kind, original_name, content_type, size_bytes, bucket, path)
  VALUES ('fx-file-1', 'fx-user-a', 'resume', 'cv.pdf', 'application/pdf', 1234, 'private', 'fx/cv.pdf');
INSERT INTO file_access_logs (id, file_id, actor_id, action) VALUES ('fx-fal-1', 'fx-file-1', 'fx-user-a', 'open');
DO $$
BEGIN
  BEGIN DELETE FROM file_access_logs; RAISE EXCEPTION 'file_access_logs DELETE was allowed';
  EXCEPTION WHEN restrict_violation THEN NULL; END;
END $$;

SELECT 'post-checks passed' AS result;
