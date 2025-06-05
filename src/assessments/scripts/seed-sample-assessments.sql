-- Insert sample assessments
INSERT INTO assessments (id, title, description, type, status, course_id, created_by, time_limit, max_attempts, passing_score, shuffle_questions, show_correct_answers, allow_review)
VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'JavaScript Fundamentals Quiz', 'Test your knowledge of JavaScript basics', 'quiz', 'published', 'course-js-101', (SELECT id FROM users WHERE email = 'teacher@example.com' LIMIT 1), 30, 3, 70.00, true, true, true),
    ('550e8400-e29b-41d4-a716-446655440002', 'Advanced Programming Exam', 'Comprehensive exam covering advanced programming concepts', 'exam', 'published', 'course-prog-advanced', (SELECT id FROM users WHERE email = 'teacher@example.com' LIMIT 1), 120, 1, 80.00, false, false, true),
    ('550e8400-e29b-41d4-a716-446655440003', 'Coding Practice Session', 'Practice coding challenges', 'practice', 'published', 'course-coding-practice', (SELECT id FROM users WHERE email = 'teacher@example.com' LIMIT 1), NULL, 999, 0.00, false, true, true);

-- Insert sample questions for JavaScript Fundamentals Quiz
INSERT INTO questions (id, assessment_id, type, question_text, explanation, points, difficulty, order_index)
VALUES 
    ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'multiple_choice', 'Which of the following is the correct way to declare a variable in JavaScript?', 'Variables in JavaScript can be declared using var, let, or const keywords. let and const are preferred in modern JavaScript.', 2.00, 'easy', 0),
    ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'true_false', 'JavaScript is a statically typed language.', 'JavaScript is a dynamically typed language, meaning variable types are determined at runtime.', 1.00, 'easy', 1),
    ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'short_answer', 'What does DOM stand for?', 'DOM stands for Document Object Model, which represents the structure of HTML documents.', 2.00, 'medium', 2),
    ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'coding_challenge', 'Write a function that returns the sum of two numbers.', 'A simple function that takes two parameters and returns their sum.', 5.00, 'easy', 3);

-- Insert options for multiple choice question
INSERT INTO question_options (question_id, option_text, is_correct, order_index, explanation)
VALUES 
    ('660e8400-e29b-41d4-a716-446655440001', 'var myVariable = value;', false, 0, 'While this works, var has function scope and is not recommended in modern JavaScript.'),
    ('660e8400-e29b-41d4-a716-446655440001', 'let myVariable = value;', true, 1, 'Correct! let is the modern way to declare variables with block scope.'),
    ('660e8400-e29b-41d4-a716-446655440001', 'variable myVariable = value;', false, 2, 'This is not valid JavaScript syntax.'),
    ('660e8400-e29b-41d4-a716-446655440001', 'const myVariable = value;', true, 3, 'Also correct! const is used for variables that won''t be reassigned.');

-- Insert options for true/false question
INSERT INTO question_options (question_id, option_text, is_correct, order_index)
VALUES 
    ('660e8400-e29b-41d4-a716-446655440002', 'True', false, 0),
    ('660e8400-e29b-41d4-a716-446655440002', 'False', true, 1);

-- Update questions with metadata for short answer and coding challenge
UPDATE questions 
SET metadata = '{"correctAnswers": ["Document Object Model", "document object model"], "keywords": ["document", "object", "model"]}'
WHERE id = '660e8400-e29b-41d4-a716-446655440003';

UPDATE questions 
SET metadata = '{
    "solution": "function sum(a, b) { return a + b; }",
    "testCases": [
        {"input": [2, 3], "expectedOutput": 5},
        {"input": [0, 0], "expectedOutput": 0},
        {"input": [-1, 1], "expectedOutput": 0},
        {"input": [10, 20], "expectedOutput": 30}
    ],
    "hints": ["Use the + operator", "Remember to return the result", "Function should take two parameters"]
}'
WHERE id = '660e8400-e29b-41d4-a716-446655440004';
