-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'quiz',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    course_id VARCHAR(255),
    created_by UUID NOT NULL,
    time_limit INTEGER,
    max_attempts INTEGER DEFAULT 1,
    passing_score DECIMAL(5,2) DEFAULT 0,
    shuffle_questions BOOLEAN DEFAULT false,
    show_correct_answers BOOLEAN DEFAULT false,
    allow_review BOOLEAN DEFAULT true,
    available_from TIMESTAMP,
    available_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    explanation TEXT,
    points DECIMAL(5,2) DEFAULT 1,
    difficulty VARCHAR(50) DEFAULT 'medium',
    order_index INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Create question_options table
CREATE TABLE IF NOT EXISTS question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    explanation TEXT,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Create assessment_attempts table
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL,
    user_id UUID NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'in_progress',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    time_spent INTEGER,
    score DECIMAL(5,2),
    percentage DECIMAL(5,2),
    passed BOOLEAN DEFAULT false,
    answers JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create assessment_results table
CREATE TABLE IF NOT EXISTS assessment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL,
    question_id UUID NOT NULL,
    user_answer JSONB,
    correct_answer JSONB,
    is_correct BOOLEAN DEFAULT false,
    points_earned DECIMAL(5,2) DEFAULT 0,
    points_possible DECIMAL(5,2) DEFAULT 0,
    feedback TEXT,
    time_spent INTEGER,
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assessments_course_id ON assessments(course_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON assessments(created_by);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_questions_assessment_id ON questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_id ON assessment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment_id ON assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_attempt_id ON assessment_results(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_question_id ON assessment_results(question_id);
