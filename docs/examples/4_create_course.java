import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class CreateCourseExample {
    public static void createCourse() throws IOException {
        URL url = new URL("http://localhost:3000/courses");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + accessToken);
        connection.setDoOutput(true);
        
        String jsonInput = "{"title":"Advanced TypeScript","description":"Master TypeScript type system and advanced patterns.","category":"programming","level":"advanced","price":5999}";
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = jsonInput.getBytes("utf-8");
            os.write(input, 0, input.length);
        }
        
        int code = connection.getResponseCode();
        System.out.println("Response Code: " + code);
    }
    
    public static void main(String[] args) throws IOException {
        createCourse();
    }
}